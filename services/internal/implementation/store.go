package implementation

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/go-crm/services/pkg/database"
)

type store struct {
	pool *pgxpool.Pool
}

const askColumns = `
	a.id::text, a.org_id::text,
	a.deal_id::text, a.lead_id::text, a.account_id::text,
	d.title, l.title, ac.name,
	a.title, a.type, a.detail, a.priority, a.status, a.blocked_reason,
	a.assigned_to::text, pa.full_name,
	a.created_by::text, pc.full_name,
	a.due_at, a.position,
	a.delivered_at, a.verified_at, a.created_at, a.updated_at`

const askFrom = `
	FROM implementation_asks a
	LEFT JOIN deals    d  ON d.id  = a.deal_id
	LEFT JOIN leads    l  ON l.id  = a.lead_id
	LEFT JOIN accounts ac ON ac.id = a.account_id
	LEFT JOIN profiles pa ON pa.id = a.assigned_to
	LEFT JOIN profiles pc ON pc.id = a.created_by `

type rowScanner interface{ Scan(dest ...any) error }

func scanAsk(row rowScanner) (Ask, error) {
	var a Ask
	err := row.Scan(
		&a.ID, &a.OrgID,
		&a.DealID, &a.LeadID, &a.AccountID,
		&a.DealTitle, &a.LeadTitle, &a.AccountName,
		&a.Title, &a.Type, &a.Detail, &a.Priority, &a.Status, &a.BlockedReason,
		&a.AssignedTo, &a.AssignedToName,
		&a.CreatedBy, &a.CreatedByName,
		&a.DueAt, &a.Position,
		&a.DeliveredAt, &a.VerifiedAt, &a.CreatedAt, &a.UpdatedAt,
	)
	return a, err
}

// where builds the shared filter fragment. orgID is always $1.
func where(orgID string, f Filter) (string, []any) {
	sql := ` WHERE a.org_id = $1::uuid
	           AND (a.deal_id IS NULL OR d.deleted_at IS NULL)
	           AND (a.lead_id IS NULL OR l.deleted_at IS NULL)`
	args := []any{orgID}

	add := func(fragment string, v any, cast string) {
		args = append(args, v)
		sql += fragment + "$" + strconv.Itoa(len(args)) + cast
	}
	if f.DealID != "" {
		add(" AND a.deal_id = ", f.DealID, "::uuid")
	}
	if f.LeadID != "" {
		add(" AND a.lead_id = ", f.LeadID, "::uuid")
	}
	if f.AccountID != "" {
		add(" AND a.account_id = ", f.AccountID, "::uuid")
	}
	if f.Status != "" {
		add(" AND a.status = ", f.Status, "")
	}
	if f.Type != "" {
		add(" AND a.type = ", f.Type, "")
	}
	if f.AssignedTo != "" {
		add(" AND a.assigned_to = ", f.AssignedTo, "::uuid")
	}
	if f.OpenOnly {
		sql += ` AND a.status NOT IN ('verified', 'wont_do')`
	}
	if f.Overdue {
		sql += ` AND a.due_at IS NOT NULL AND a.due_at < now()
		         AND a.status NOT IN ('verified', 'wont_do')`
	}
	return sql, args
}

func (s *store) list(ctx context.Context, orgID string, f Filter) ([]Ask, error) {
	cond, args := where(orgID, f)
	rows, err := s.pool.Query(ctx,
		`SELECT `+askColumns+askFrom+cond+`
		  ORDER BY a.status, a.position, a.created_at`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Ask, 0, 32)
	for rows.Next() {
		a, err := scanAsk(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *store) get(ctx context.Context, orgID, id string) (Ask, error) {
	a, err := scanAsk(s.pool.QueryRow(ctx,
		`SELECT `+askColumns+askFrom+` WHERE a.org_id = $1::uuid AND a.id = $2::uuid`,
		orgID, id))
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Ask{}, ErrNotFound
	}
	return a, err
}

// create inserts at the end of the "requested" column. account_id is derived
// from the parent in SQL so it cannot drift from it.
func (s *store) create(ctx context.Context, orgID, actorID string, in Input) (Ask, error) {
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO implementation_asks (
		     org_id, deal_id, lead_id, account_id,
		     title, type, detail, priority, assigned_to, created_by, due_at, position)
		 VALUES (
		     $1::uuid, $2::uuid, $3::uuid,
		     COALESCE(
		         (SELECT account_id FROM deals WHERE id = $2::uuid),
		         (SELECT account_id FROM leads WHERE id = $3::uuid)),
		     $4, $5, $6, $7, $8::uuid, $9::uuid, $10,
		     COALESCE((SELECT max(position) + 1 FROM implementation_asks
		                WHERE org_id = $1::uuid AND status = 'requested'), 0))
		 RETURNING id::text`,
		orgID, in.DealID, in.LeadID,
		in.Title, in.Type, in.Detail, in.Priority, in.AssignedTo,
		nilIfEmpty(actorID), in.DueAt).Scan(&id)
	if err != nil {
		return Ask{}, err
	}
	return s.get(ctx, orgID, id)
}

// update writes the editable fields; status moves through move().
func (s *store) update(ctx context.Context, orgID, id string, in Input) (Ask, error) {
	tag, err := s.pool.Exec(ctx,
		`UPDATE implementation_asks
		    SET title = $3, type = $4, detail = $5, priority = $6,
		        assigned_to = $7::uuid, due_at = $8, updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid`,
		orgID, id, in.Title, in.Type, in.Detail, in.Priority, in.AssignedTo, in.DueAt)
	if err != nil {
		if database.IsInvalidTextRepr(err) {
			return Ask{}, ErrNotFound
		}
		return Ask{}, err
	}
	if tag.RowsAffected() == 0 {
		return Ask{}, ErrNotFound
	}
	return s.get(ctx, orgID, id)
}

// move changes status and returns the previous one, so the caller can record
// the transition without a second read. delivered_at and verified_at are
// stamped once and never cleared.
func (s *store) move(ctx context.Context, orgID, id, status, reason string) (Ask, string, error) {
	var previous string
	err := s.pool.QueryRow(ctx,
		`WITH prev AS (
		     SELECT status FROM implementation_asks
		      WHERE org_id = $1::uuid AND id = $2::uuid)
		 UPDATE implementation_asks a
		    SET status = $3,
		        delivered_at = CASE WHEN $3 = 'delivered'
		                            THEN COALESCE(a.delivered_at, now())
		                            ELSE a.delivered_at END,
		        verified_at  = CASE WHEN $3 = 'verified'
		                            THEN COALESCE(a.verified_at, now())
		                            ELSE a.verified_at END,
		        -- Cleared on leaving blocked, so it cannot outlive the block.
		        blocked_reason = CASE WHEN $3 = 'blocked' THEN $4 ELSE '' END,
		        position = COALESCE(
		            (SELECT max(position) + 1 FROM implementation_asks
		              WHERE org_id = $1::uuid AND status = $3), 0),
		        updated_at = now()
		   FROM prev
		  WHERE a.org_id = $1::uuid AND a.id = $2::uuid
		 RETURNING prev.status`,
		orgID, id, status, reason).Scan(&previous)
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Ask{}, "", ErrNotFound
	}
	if err != nil {
		return Ask{}, "", err
	}
	a, err := s.get(ctx, orgID, id)
	return a, previous, err
}

func (s *store) delete(ctx context.Context, orgID, id string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM implementation_asks WHERE org_id = $1::uuid AND id = $2::uuid`,
		orgID, id)
	if err != nil {
		if database.IsInvalidTextRepr(err) {
			return ErrNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Confirm a parent exists, so a bad id is a 400 not a foreign-key 500.
func (s *store) dealExists(ctx context.Context, id string) (bool, error) {
	return s.exists(ctx, `SELECT EXISTS (SELECT 1 FROM deals WHERE id = $1::uuid AND deleted_at IS NULL)`, id)
}

func (s *store) leadExists(ctx context.Context, id string) (bool, error) {
	return s.exists(ctx, `SELECT EXISTS (SELECT 1 FROM leads WHERE id = $1::uuid AND deleted_at IS NULL)`, id)
}

func (s *store) assigneeInOrg(ctx context.Context, orgID, userID string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (
		     SELECT 1 FROM users u
		      JOIN profiles p ON p.id = u.id
		     WHERE u.id = $2::uuid AND u.org_id = $1::uuid)`, orgID, userID).Scan(&ok)
	if err != nil && database.IsInvalidTextRepr(err) {
		return false, nil
	}
	return ok, err
}

func (s *store) exists(ctx context.Context, query, id string) (bool, error) {
	var ok bool
	if err := s.pool.QueryRow(ctx, query, id).Scan(&ok); err != nil {
		if database.IsInvalidTextRepr(err) {
			return false, nil
		}
		return false, err
	}
	return ok, nil
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// due is the rule behind the "overdue" count and the red date on a card.
func due(a Ask, now time.Time) bool {
	return a.DueAt != nil && a.DueAt.Before(now) && !IsClosed(a.Status)
}

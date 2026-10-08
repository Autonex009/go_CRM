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
	a.deal_id::text, a.lead_id::text, a.account_id::text, a.parent_ask_id::text,
	d.title, l.title, ac.name, parent.title,
	COALESCE(sub.cnt, 0), COALESCE(sub.done_cnt, 0),
	a.title, a.type, a.detail, a.priority, a.status, a.blocked_reason,
	a.assigned_to::text, pa.full_name,
	a.created_by::text, pc.full_name, pc.role,
	a.due_at, a.position,
	a.delivered_at, a.verified_at, a.created_at, a.updated_at,
	COALESCE(loc.names, NULLIF(btrim(d.location), ''), NULLIF(btrim(l.location), '')),
	pl.id::text,
	a.comment_count, a.review_status, a.review_note, a.submitted_at, a.reviewed_at`

const askFrom = `
	FROM implementation_asks a
	LEFT JOIN deals    d  ON d.id  = a.deal_id
	LEFT JOIN leads    l  ON l.id  = a.lead_id
	LEFT JOIN accounts ac ON ac.id = a.account_id
	LEFT JOIN implementation_asks parent ON parent.id = a.parent_ask_id
	LEFT JOIN profiles pa ON pa.id = a.assigned_to
	LEFT JOIN profiles pc ON pc.id = a.created_by
	LEFT JOIN LATERAL (
		SELECT count(*) as cnt,
		       count(*) FILTER (WHERE status IN ('delivered', 'verified')) as done_cnt
		FROM implementation_asks
		WHERE parent_ask_id = a.id
	) sub ON true
	LEFT JOIN implementation_pipelines pl
	       ON pl.org_id = a.org_id AND pl.account_id = a.account_id
	-- The deal's sites, in the order they were picked: "Plant 1 (Pune); Nashik".
	-- Only name and city — never the site's address or contact details.
	LEFT JOIN LATERAL (
		SELECT string_agg(
		         al.name || CASE
		           WHEN NULLIF(btrim(al.city), '') IS NOT NULL
		            AND lower(btrim(al.city)) <> lower(btrim(al.name))
		           THEN ' (' || btrim(al.city) || ')' ELSE '' END,
		         '; ' ORDER BY dl.position) AS names
		  FROM deal_locations dl
		  JOIN account_locations al ON al.id = dl.location_id
		 WHERE dl.deal_id = a.deal_id
	) loc ON true `

type rowScanner interface{ Scan(dest ...any) error }

func scanAsk(row rowScanner) (Ask, error) {
	var a Ask
	err := row.Scan(
		&a.ID, &a.OrgID,
		&a.DealID, &a.LeadID, &a.AccountID, &a.ParentAskID,
		&a.DealTitle, &a.LeadTitle, &a.AccountName, &a.ParentTitle,
		&a.SubtaskCount, &a.SubtaskDoneCount,
		&a.Title, &a.Type, &a.Detail, &a.Priority, &a.Status, &a.BlockedReason,
		&a.AssignedTo, &a.AssignedToName,
		&a.CreatedBy, &a.CreatedByName, &a.CreatedByRole,
		&a.DueAt, &a.Position,
		&a.DeliveredAt, &a.VerifiedAt, &a.CreatedAt, &a.UpdatedAt,
		&a.Locations, &a.PipelineID,
		&a.CommentCount, &a.ReviewStatus, &a.ReviewNote, &a.SubmittedAt, &a.ReviewedAt,
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
	if f.ParentAskID != "" {
		add(" AND a.parent_ask_id = ", f.ParentAskID, "::uuid")
	}
	if f.TopLevelOnly {
		sql += ` AND a.parent_ask_id IS NULL`
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
	if len(f.AssigneeIDs) > 0 {
		args = append(args, f.AssigneeIDs)
		sql += " AND a.assigned_to::text = ANY($" + strconv.Itoa(len(args)) + "::text[])"
	}
	if f.OpenOnly {
		sql += ` AND a.status NOT IN ('verified', 'wont_do')`
	}
	if f.ReviewStatus != "" {
		add(" AND a.review_status = ", f.ReviewStatus, "")
	}
	if f.ViewerID != "" {
		if clause := VisibleClause("a", f.ViewerRole, "$"+strconv.Itoa(len(args)+1)); clause != "" {
			args = append(args, f.ViewerID)
			sql += " AND " + clause
		}
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
// from in.AccountID or from the parent in SQL so it cannot drift from it.
// request marks it a pending manager request.
func (s *store) create(ctx context.Context, orgID, actorID string, in Input, request bool) (Ask, error) {
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO implementation_asks (
		     org_id, deal_id, lead_id, account_id, parent_ask_id,
		     title, type, detail, priority, assigned_to, created_by, due_at, position,
		     review_status, submitted_by, submitted_at)
		 VALUES (
		     $1::uuid, $2::uuid, $3::uuid,
		     COALESCE(
		         (SELECT account_id FROM deals WHERE id = $2::uuid),
		         (SELECT account_id FROM leads WHERE id = $3::uuid),
		         (SELECT account_id FROM implementation_asks WHERE id = $4::uuid),
		         $12::uuid),
		     $4::uuid,
		     $5, $6, $7, $8, $9::uuid, $10::uuid, $11,
		     COALESCE((SELECT max(position) + 1 FROM implementation_asks
		                WHERE org_id = $1::uuid AND status = 'requested'), 0),
		     CASE WHEN $13 THEN 'pending' END,
		     CASE WHEN $13 THEN $10::uuid END,
		     CASE WHEN $13 THEN now() END)
		 RETURNING id::text`,
		orgID, in.DealID, in.LeadID, in.ParentAskID,
		in.Title, in.Type, in.Detail, in.Priority, in.AssignedTo,
		nilIfEmpty(actorID), in.DueAt, in.AccountID, request).Scan(&id)
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
		        assigned_to = $7::uuid, due_at = $8,
		        blocked_reason = CASE WHEN status = 'blocked' AND $9::text IS NOT NULL AND $9::text <> '' THEN $9::text ELSE blocked_reason END,
		        updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid`,
		orgID, id, in.Title, in.Type, in.Detail, in.Priority, in.AssignedTo, in.DueAt, in.BlockedReason)
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
		        blocked_reason = CASE WHEN $3 = 'blocked'
		                              THEN CASE WHEN $4 <> '' THEN $4 ELSE a.blocked_reason END
		                              ELSE '' END,
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
func (s *store) dealExists(ctx context.Context, orgID, id string) (bool, error) {
	return s.existsInOrg(ctx, `SELECT EXISTS (`+dealInOrgSQL+`)`, orgID, id)
}

func (s *store) leadExists(ctx context.Context, orgID, id string) (bool, error) {
	return s.existsInOrg(ctx,
		`SELECT EXISTS (
		     SELECT 1 FROM leads l
		      WHERE l.id = $2::uuid AND l.deleted_at IS NULL
		        AND (l.org_id = $1::uuid
		             OR EXISTS (SELECT 1 FROM users u WHERE u.id = l.owner_user_id AND u.org_id = $1::uuid)))`,
		orgID, id)
}

func (s *store) existsInOrg(ctx context.Context, query, orgID, id string) (bool, error) {
	var ok bool
	if err := s.pool.QueryRow(ctx, query, orgID, id).Scan(&ok); err != nil {
		if database.IsInvalidTextRepr(err) {
			return false, nil
		}
		return false, err
	}
	return ok, nil
}

func (s *store) askExists(ctx context.Context, orgID, id string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM implementation_asks WHERE id = $1::uuid AND org_id = $2::uuid)`,
		id, orgID).Scan(&ok)
	if err != nil && database.IsInvalidTextRepr(err) {
		return false, nil
	}
	return ok, err
}

func (s *store) getParentRefs(ctx context.Context, orgID, parentID string) (dealID, leadID, accountID *string, err error) {
	var d, l, a *string
	err = s.pool.QueryRow(ctx,
		`SELECT deal_id::text, lead_id::text, account_id::text FROM implementation_asks WHERE id = $1::uuid AND org_id = $2::uuid`,
		parentID, orgID).Scan(&d, &l, &a)
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return nil, nil, nil, ErrNotFound
	}
	return d, l, a, err
}

// visible reports whether a viewer may see one ask. An id that does not parse
// is simply not visible.
func (s *store) visible(ctx context.Context, orgID, id, viewerID, viewerRole string) (bool, error) {
	clause := VisibleClause("a", viewerRole, "$3")
	args := []any{orgID, id}
	if clause == "" {
		clause = "true"
	} else {
		args = append(args, viewerID)
	}
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (
		     SELECT 1 FROM implementation_asks a
		      WHERE a.org_id = $1::uuid AND a.id = $2::uuid AND `+clause+`)`,
		args...).Scan(&ok)
	if err != nil && database.IsInvalidTextRepr(err) {
		return false, nil
	}
	return ok, err
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

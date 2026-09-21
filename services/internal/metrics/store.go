package metrics

import (
	"context"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// stalledAfterDays is how long an open deal may sit untouched before the page
// calls it stalled. A week is the shortest gap that is not just "nobody worked
// the weekend".
const stalledAfterDays = 14

// stalledLimit caps the working list. It is a call sheet, not an export.
const stalledLimit = 20

type store struct {
	pool *pgxpool.Pool
}

// where builds the filter shared by every query here, as a SQL fragment plus
// its arguments.
//
// deals carry no org_id in this schema — no module scopes deals, accounts or
// leads by organisation (see deals/store.go, which ignores the org it is
// handed) — so the filter is dates and owner, and nothing else. When deals do
// get an org column, this is the one function that has to learn about it.
func where(f Filter) (string, []any) {
	sql := " WHERE d.deleted_at IS NULL"
	args := []any{}

	add := func(fragment string, v any) {
		args = append(args, v)
		sql += fragment + arg(len(args))
	}
	if f.From != nil {
		add(" AND d.created_at >= ", *f.From)
	}
	if f.To != nil {
		add(" AND d.created_at <= ", *f.To)
	}
	if f.OwnerID != "" {
		add(" AND d.owner_id = ", f.OwnerID)
		sql += "::uuid"
	}
	return sql, args
}

// arg renders the nth placeholder. Numbering always comes from the length of
// the argument slice, which is what keeps the two in step.
func arg(n int) string { return "$" + strconv.Itoa(n) }

// stages returns one row per stage that has at least one deal.
func (s *store) stages(ctx context.Context, f Filter) ([]StageRow, error) {
	cond, args := where(f)
	rows, err := s.pool.Query(ctx,
		`SELECT d.stage,
		        count(*)::int,
		        coalesce(sum(d.amount), 0)::float8,
		        coalesce(sum(d.total_cameras), 0)::int
		   FROM deals d`+cond+`
		  GROUP BY d.stage`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]StageRow, 0, 8)
	for rows.Next() {
		var r StageRow
		if err := rows.Scan(&r.Stage, &r.Count, &r.Value, &r.Cameras); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// owners returns one row per person with at least one deal.
//
// The name comes from profiles, like every other owner lookup in the codebase;
// a deal whose owner has no profile row is grouped under an empty id, which the
// service labels "Unassigned" rather than dropping — an unowned deal is a fact
// about the pipeline worth seeing.
func (s *store) owners(ctx context.Context, f Filter) ([]OwnerRow, error) {
	cond, args := where(f)
	rows, err := s.pool.Query(ctx,
		`SELECT coalesce(d.owner_id::text, ''),
		        coalesce(p.full_name, ''),
		        count(*) FILTER (WHERE d.stage = ANY($`+strconv.Itoa(len(args)+1)+`))::int,
		        coalesce(sum(d.amount) FILTER (WHERE d.stage = ANY($`+strconv.Itoa(len(args)+1)+`)), 0)::float8,
		        count(*) FILTER (WHERE d.stage = ANY($`+strconv.Itoa(len(args)+2)+`))::int,
		        coalesce(sum(d.amount) FILTER (WHERE d.stage = ANY($`+strconv.Itoa(len(args)+2)+`)), 0)::float8,
		        coalesce(sum(d.total_cameras), 0)::int
		   FROM deals d
		   LEFT JOIN profiles p ON p.id = d.owner_id`+cond+`
		  GROUP BY d.owner_id, p.full_name`,
		append(args, openStages, wonStages)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]OwnerRow, 0, 8)
	for rows.Next() {
		var r OwnerRow
		if err := rows.Scan(&r.OwnerID, &r.Name, &r.OpenCount, &r.OpenValue,
			&r.WonCount, &r.WonValue, &r.Cameras); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// months returns deals created per month, and how many of them are now won.
//
// "Won in the month it was created" is not what this measures and cannot be:
// the schema records no close date for a won deal, only expected_close_date,
// which is a forecast and frequently empty. Grouping by creation month and
// counting current outcome is the honest version of the question the data can
// actually answer.
func (s *store) months(ctx context.Context, f Filter) ([]MonthRow, error) {
	cond, args := where(f)
	rows, err := s.pool.Query(ctx,
		`SELECT to_char(date_trunc('month', d.created_at), 'YYYY-MM-DD'),
		        count(*)::int,
		        count(*) FILTER (WHERE d.stage = ANY($`+strconv.Itoa(len(args)+1)+`))::int,
		        coalesce(sum(d.amount) FILTER (WHERE d.stage = ANY($`+strconv.Itoa(len(args)+1)+`)), 0)::float8,
		        coalesce(sum(d.total_cameras), 0)::int
		   FROM deals d`+cond+`
		  GROUP BY 1
		  ORDER BY 1`,
		append(args, wonStages)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]MonthRow, 0, 12)
	for rows.Next() {
		var r MonthRow
		if err := rows.Scan(&r.Month, &r.Created, &r.Won, &r.WonValue, &r.Cameras); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// stalled lists open deals nobody has touched lately, richest first.
func (s *store) stalled(ctx context.Context, f Filter, now time.Time) ([]StalledRow, error) {
	cond, args := where(f)
	cutoff := now.AddDate(0, 0, -stalledAfterDays)
	args = append(args, openStages, cutoff, stalledLimit)
	n := len(args)

	rows, err := s.pool.Query(ctx,
		`SELECT d.id::text, d.title,
		        coalesce(a.name, ''), d.stage,
		        coalesce(d.amount, 0)::float8,
		        coalesce(d.total_cameras, 0)::int,
		        coalesce(p.full_name, ''),
		        d.updated_at
		   FROM deals d
		   LEFT JOIN accounts a ON a.id = d.account_id
		   LEFT JOIN profiles p ON p.id = d.owner_id`+cond+`
		    AND d.stage = ANY($`+strconv.Itoa(n-2)+`)
		    AND d.updated_at < $`+strconv.Itoa(n-1)+`
		  ORDER BY d.amount DESC NULLS LAST, d.updated_at ASC
		  LIMIT $`+strconv.Itoa(n), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]StalledRow, 0, stalledLimit)
	for rows.Next() {
		var r StalledRow
		if err := rows.Scan(&r.DealID, &r.Title, &r.AccountName, &r.Stage,
			&r.Amount, &r.Cameras, &r.OwnerName, &r.UpdatedAt); err != nil {
			return nil, err
		}
		r.IdleDays = int(now.Sub(r.UpdatedAt).Hours() / 24)
		out = append(out, r)
	}
	return out, rows.Err()
}

// coverage counts how many deals carry the fields the money figures need.
func (s *store) coverage(ctx context.Context, f Filter) (Coverage, error) {
	cond, args := where(f)
	var c Coverage
	err := s.pool.QueryRow(ctx,
		`SELECT count(*)::int,
		        count(*) FILTER (WHERE d.amount > 0)::int,
		        count(*) FILTER (WHERE coalesce(d.total_cameras, 0) > 0)::int
		   FROM deals d`+cond, args...).
		Scan(&c.Deals, &c.Priced, &c.WithCameras)
	return c, err
}

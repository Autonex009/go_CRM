package metrics

import (
	"context"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/errgroup"

	"github.com/go-crm/services/internal/deals"
)

// openStages is everything still being worked, and wonStages everything that
// closed. They partition deals.Stages between them: "won" is the moment the
// order is booked, and delivery and post_delivery are that same won deal
// further along — counting them as open would make the pipeline look fuller
// than it is and hide revenue from the won total.
var (
	openStages = []string{"discovery", "site_assessment", "quote_sent", "negotiation"}
	wonStages  = []string{"won", "delivery", "post_delivery"}
)

// quotedStage is the column whose value answers "how much is out on quotation".
const quotedStage = "quote_sent"

// reportFanOut caps how many of the report's queries run at once.
//
// The same reasoning as the dashboard's: the pool holds a small fixed number of
// connections, so an unbounded fan-out would let one analytics load take every
// one of them and stall every other request behind it.
const reportFanOut = 3

// Service computes the analytics report.
type Service struct {
	store *store
	// now is injectable so the stalled-deal cutoff can be tested against a
	// fixed clock rather than whenever the suite happens to run.
	now func() time.Time
}

// NewService builds the service over a pgx pool.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: &store{pool: pool}, now: time.Now}
}

// Report assembles the whole analytics page.
func (s *Service) Report(ctx context.Context, f Filter) (Report, error) {
	var (
		rep    Report
		stages []StageRow
		owners []OwnerRow
		months []MonthRow
		idle   []StalledRow
		cov    Coverage
	)
	now := s.now().UTC()

	// Each goroutine writes one distinct variable and reads none of the others,
	// so no lock is needed. Keep it that way — a piece that starts depending on
	// another's result has to move out of the group.
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(reportFanOut)

	g.Go(func() (err error) { stages, err = s.store.stages(gctx, f); return })
	g.Go(func() (err error) { owners, err = s.store.owners(gctx, f); return })
	g.Go(func() (err error) { months, err = s.store.months(gctx, f); return })
	g.Go(func() (err error) { idle, err = s.store.stalled(gctx, f, now); return })
	g.Go(func() (err error) { cov, err = s.store.coverage(gctx, f); return })

	if err := g.Wait(); err != nil {
		return Report{}, err
	}

	rep.GeneratedAt = now
	rep.Stages = fillStages(stages)
	rep.Totals = totals(rep.Stages, cov)
	rep.Owners = rankOwners(owners)
	rep.Months = fillMonths(months)
	rep.Stalled = idle
	rep.Coverage = cov
	return rep, nil
}

// fillStages returns one row per stage the board defines, in board order,
// inserting empty rows for stages nothing sits in.
//
// A funnel with columns missing is not a funnel — the eye reads the gap as a
// stage that does not exist rather than one that is empty, which is the
// opposite of what an empty stage should tell a sales manager.
func fillStages(found []StageRow) []StageRow {
	by := make(map[string]StageRow, len(found))
	for _, r := range found {
		by[r.Stage] = r
	}

	out := make([]StageRow, 0, len(deals.Stages))
	for _, stage := range deals.Stages {
		if r, ok := by[stage]; ok {
			out = append(out, r)
			continue
		}
		out = append(out, StageRow{Stage: stage})
	}
	return out
}

// totals rolls the stage rows up into the headline figures.
//
// coverage is needed for the average: the stage rows carry a value per column,
// not per deal, so they cannot say how many deals that value is spread across.
func totals(stages []StageRow, coverage Coverage) Totals {
	var t Totals
	open := set(openStages)
	won := set(wonStages)

	for _, r := range stages {
		t.Deals += r.Count
		t.TotalCameras += r.Cameras

		switch {
		case open[r.Stage]:
			t.OpenCount += r.Count
			t.OpenValue += r.Value
			t.OpenCameras += r.Cameras
		case won[r.Stage]:
			t.WonCount += r.Count
			t.WonValue += r.Value
			t.WonCameras += r.Cameras
		}
		if r.Stage == quotedStage {
			t.QuotedValue = r.Value
		}
	}

	// Averaged over deals that carry a value, not over all of them: including
	// the un-priced ones would report an average that drops every time someone
	// files a deal without an amount, which reads as the pipeline shrinking.
	//
	// The divisor is the exact count from coverage. It used to be inferred from
	// the stage rows — a stage with any value at all contributed its whole count
	// — which on this pipeline divided one priced deal by the seven sitting in
	// its column and under-reported the average sevenfold.
	if valued := t.OpenValue + t.WonValue; valued > 0 && coverage.Priced > 0 {
		t.AvgDealSize = valued / float64(coverage.Priced)
	}
	if t.WonCameras > 0 {
		t.ValuePerCamera = t.WonValue / float64(t.WonCameras)
	}
	if t.Deals > 0 {
		t.ConversionRate = float64(t.WonCount) / float64(t.Deals) * 100
	}
	return t
}

// rankOwners sorts the leaderboard by what has actually closed, then by what is
// still open — the order a sales manager reads it in.
func rankOwners(rows []OwnerRow) []OwnerRow {
	out := make([]OwnerRow, len(rows))
	copy(out, rows)

	for i := range out {
		if out[i].Name == "" {
			out[i].Name = "Unassigned"
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].WonValue != out[j].WonValue {
			return out[i].WonValue > out[j].WonValue
		}
		if out[i].OpenValue != out[j].OpenValue {
			return out[i].OpenValue > out[j].OpenValue
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// fillMonths inserts the months nothing happened in, so the trend line has a
// point per month and the chart does not draw a straight edge across a gap as
// though the months between did not exist.
func fillMonths(rows []MonthRow) []MonthRow {
	if len(rows) == 0 {
		return []MonthRow{}
	}

	by := make(map[string]MonthRow, len(rows))
	for _, r := range rows {
		by[r.Month] = r
	}

	first, err := time.Parse("2006-01-02", rows[0].Month)
	if err != nil {
		return rows // unparseable: hand back what the database said
	}
	last, err := time.Parse("2006-01-02", rows[len(rows)-1].Month)
	if err != nil {
		return rows
	}

	out := make([]MonthRow, 0, len(rows))
	for m := first; !m.After(last); m = m.AddDate(0, 1, 0) {
		key := m.Format("2006-01-02")
		if r, ok := by[key]; ok {
			out = append(out, r)
			continue
		}
		out = append(out, MonthRow{Month: key})
	}
	return out
}

func set(values []string) map[string]bool {
	m := make(map[string]bool, len(values))
	for _, v := range values {
		m[v] = true
	}
	return m
}

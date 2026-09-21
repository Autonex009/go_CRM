package metrics

import (
	"testing"

	"github.com/go-crm/services/internal/deals"
)

func TestFillStagesReturnsEveryBoardColumnInOrder(t *testing.T) {
	// Arrange: only two stages have deals in them.
	found := []StageRow{
		{Stage: "negotiation", Count: 8, Value: 400, Cameras: 240},
		{Stage: "discovery", Count: 6, Cameras: 6},
	}

	// Act
	got := fillStages(found)

	// Assert: every column the board draws, in the board's order.
	if len(got) != len(deals.Stages) {
		t.Fatalf("got %d stages, want %d", len(got), len(deals.Stages))
	}
	for i, stage := range deals.Stages {
		if got[i].Stage != stage {
			t.Errorf("position %d: got %q, want %q", i, got[i].Stage, stage)
		}
	}
	if got[0].Count != 6 {
		t.Errorf("discovery count: got %d, want 6", got[0].Count)
	}
	// A stage nobody is in is present and empty, not missing.
	if q := stageByName(got, "quote_sent"); q.Count != 0 || q.Value != 0 {
		t.Errorf("empty stage should be zeroed, got %+v", q)
	}
}

func TestTotalsSplitsOpenFromWon(t *testing.T) {
	// Arrange: one deal in each of four stages, spanning both sides of the line.
	stages := fillStages([]StageRow{
		{Stage: "discovery", Count: 2, Value: 100, Cameras: 10},
		{Stage: "quote_sent", Count: 3, Value: 30_000_000, Cameras: 30},
		{Stage: "won", Count: 1, Value: 500, Cameras: 50},
		{Stage: "delivery", Count: 4, Value: 900, Cameras: 128},
	})

	// Act
	got := totals(stages, Coverage{Deals: 10, Priced: 10})

	// Assert
	if got.Deals != 10 {
		t.Errorf("deals: got %d, want 10", got.Deals)
	}
	if got.OpenCount != 5 || got.OpenValue != 30_000_100 {
		t.Errorf("open: got %d/%v, want 5/30000100", got.OpenCount, got.OpenValue)
	}
	// delivery is a won deal further along, not a separate outcome.
	if got.WonCount != 5 || got.WonValue != 1400 {
		t.Errorf("won: got %d/%v, want 5/1400", got.WonCount, got.WonValue)
	}
	if got.QuotedValue != 30_000_000 {
		t.Errorf("quoted: got %v, want 30000000", got.QuotedValue)
	}
	if got.WonCameras != 178 {
		t.Errorf("won cameras: got %d, want 178", got.WonCameras)
	}
	if got.TotalCameras != 218 {
		t.Errorf("total cameras: got %d, want 218", got.TotalCameras)
	}
}

func TestTotalsOnAnEmptyPipelineDoesNotDivideByZero(t *testing.T) {
	// Arrange: the state a fresh workspace is in.
	stages := fillStages(nil)

	// Act
	got := totals(stages, Coverage{})

	// Assert: zeroes, not NaN — a NaN serialises as null and blanks the tile.
	if got.AvgDealSize != 0 || got.ValuePerCamera != 0 || got.ConversionRate != 0 {
		t.Errorf("got %+v, want all zero", got)
	}
}

func TestAvgDealSizeIgnoresUnpricedDeals(t *testing.T) {
	// Arrange: the shape of the live pipeline — most deals carry no amount.
	// Averaging across all eleven would report 45,454, which falls every time
	// someone files a deal without a price.
	stages := fillStages([]StageRow{
		{Stage: "discovery", Count: 10},          // no value typed in
		{Stage: "won", Count: 1, Value: 500_000}, // the only priced deal
	})

	// Act
	got := totals(stages, Coverage{Deals: 11, Priced: 1})

	// Assert
	if got.AvgDealSize != 500_000 {
		t.Errorf("avg deal size: got %v, want 500000", got.AvgDealSize)
	}
}

func TestAvgDealSizeCountsPricedDealsNotTheirWholeStage(t *testing.T) {
	// The regression this replaced: one priced deal sitting in a stage of seven
	// used to be divided by all seven, under-reporting the average sevenfold.
	// Only coverage knows how many deals actually carry a value.
	stages := fillStages([]StageRow{
		{Stage: "site_assessment", Count: 7, Value: 1_200_000},
	})

	got := totals(stages, Coverage{Deals: 27, Priced: 1})

	if got.AvgDealSize != 1_200_000 {
		t.Errorf("avg deal size: got %v, want 1200000", got.AvgDealSize)
	}
}

func TestAvgDealSizeWithNoPricedDealsIsZero(t *testing.T) {
	// Coverage.Priced of zero must not divide, even if a stage somehow carries
	// a value — the tile shows a dash rather than an infinity.
	stages := fillStages([]StageRow{{Stage: "discovery", Count: 3, Value: 100}})

	if got := totals(stages, Coverage{Deals: 3}).AvgDealSize; got != 0 {
		t.Errorf("got %v, want 0", got)
	}
}

func TestConversionRateIsWonOverTotal(t *testing.T) {
	stages := fillStages([]StageRow{
		{Stage: "discovery", Count: 3},
		{Stage: "won", Count: 1},
	})

	if got := totals(stages, Coverage{Deals: 4}).ConversionRate; got != 25 {
		t.Errorf("conversion: got %v, want 25", got)
	}
}

func TestRankOwnersOrdersByClosedThenOpen(t *testing.T) {
	// Arrange
	rows := []OwnerRow{
		{Name: "Amaan", OpenValue: 900},
		{Name: "Nikhil", WonValue: 100, OpenValue: 5},
		{Name: "", OpenValue: 1}, // a deal nobody owns
	}

	// Act
	got := rankOwners(rows)

	// Assert
	if got[0].Name != "Nikhil" {
		t.Errorf("first: got %q, want Nikhil", got[0].Name)
	}
	if got[1].Name != "Amaan" {
		t.Errorf("second: got %q, want Amaan", got[1].Name)
	}
	// An unowned deal is a fact about the pipeline, so it is labelled, not dropped.
	if got[2].Name != "Unassigned" {
		t.Errorf("third: got %q, want Unassigned", got[2].Name)
	}
}

func TestRankOwnersDoesNotMutateItsInput(t *testing.T) {
	rows := []OwnerRow{{Name: "Amaan"}, {Name: "Nikhil", WonValue: 10}}

	rankOwners(rows)

	if rows[0].Name != "Amaan" {
		t.Errorf("input was reordered: got %q first", rows[0].Name)
	}
}

func TestFillMonthsInsertsTheQuietMonths(t *testing.T) {
	// Arrange: nothing was created in February or March.
	rows := []MonthRow{
		{Month: "2026-01-01", Created: 4},
		{Month: "2026-04-01", Created: 2},
	}

	// Act
	got := fillMonths(rows)

	// Assert: four points, so the line does not jump the gap.
	if len(got) != 4 {
		t.Fatalf("got %d months, want 4", len(got))
	}
	want := []string{"2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"}
	for i, m := range want {
		if got[i].Month != m {
			t.Errorf("position %d: got %q, want %q", i, got[i].Month, m)
		}
	}
	if got[1].Created != 0 {
		t.Errorf("filled month should be empty, got %d", got[1].Created)
	}
}

func TestFillMonthsOnNoDataReturnsAnEmptySlice(t *testing.T) {
	// A nil slice encodes as JSON null, which is what crashes a client reaching
	// for .length — the same bug the mobile notifications feed hit.
	got := fillMonths(nil)
	if got == nil {
		t.Fatal("got nil, want an empty slice")
	}
	if len(got) != 0 {
		t.Errorf("got %d months, want 0", len(got))
	}
}

func TestOpenAndWonStagesPartitionTheBoard(t *testing.T) {
	// Every stage the board defines must be counted exactly once, or a deal
	// disappears from the totals when someone adds a stage.
	seen := map[string]int{}
	for _, s := range append(append([]string{}, openStages...), wonStages...) {
		seen[s]++
	}

	for _, stage := range deals.Stages {
		switch seen[stage] {
		case 1:
		case 0:
			t.Errorf("stage %q is in neither openStages nor wonStages", stage)
		default:
			t.Errorf("stage %q is in both openStages and wonStages", stage)
		}
	}
	if len(seen) != len(deals.Stages) {
		t.Errorf("a stage is listed that the board does not define: %v", seen)
	}
}

func stageByName(rows []StageRow, name string) StageRow {
	for _, r := range rows {
		if r.Stage == name {
			return r
		}
	}
	return StageRow{}
}

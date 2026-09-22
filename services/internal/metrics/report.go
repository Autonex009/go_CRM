// Package metrics is the backend for the sales analytics page.
//
// Like dashboard, it owns no tables: every number here is aggregated straight
// out of the modules' own tables, so a metric cannot drift from the board it
// claims to describe. Unlike dashboard, which answers "what is happening right
// now", this answers "how is the pipeline doing" — the same rows, grouped and
// counted rather than listed.
package metrics

import "time"

// Filter narrows a report. A zero value means the whole pipeline, all time.
type Filter struct {
	// From and To bound a deal's creation date. Both are optional and both ends
	// are inclusive.
	From *time.Time
	To   *time.Time
	// OwnerID limits the report to one person's deals. The handler sets it
	// unconditionally for a rep, who may only see their own.
	OwnerID string
}

// StageRow is one column of the pipeline, counted.
type StageRow struct {
	Stage string `json:"stage"`
	Count int    `json:"count"`
	// Value is the sum of deal amounts. It reads low wherever deals were created
	// without one — see Coverage, which is what stops that being mistaken for a
	// real zero.
	Value   float64 `json:"value"`
	Cameras int     `json:"cameras"`
}

// OwnerRow is one salesperson's contribution.
type OwnerRow struct {
	OwnerID   string  `json:"ownerId"`
	Name      string  `json:"name"`
	OpenCount int     `json:"openCount"`
	OpenValue float64 `json:"openValue"`
	WonCount  int     `json:"wonCount"`
	WonValue  float64 `json:"wonValue"`
	Cameras   int     `json:"cameras"`
}

// MonthRow is one month of the trend line. Months with no deals are filled in
// by the service, so the chart has no gaps to interpolate across.
type MonthRow struct {
	// Month is the first day of the month, as YYYY-MM-01.
	Month    string  `json:"month"`
	Created  int     `json:"created"`
	Won      int     `json:"won"`
	WonValue float64 `json:"wonValue"`
	Cameras  int     `json:"cameras"`
}

// StalledRow is one open deal that has not moved in a while — the working list
// the page exists to produce, ordered by what it would be worth to unstick.
type StalledRow struct {
	DealID      string    `json:"dealId"`
	Title       string    `json:"title"`
	AccountName string    `json:"accountName"`
	Stage       string    `json:"stage"`
	Amount      float64   `json:"amount"`
	Cameras     int       `json:"cameras"`
	OwnerName   string    `json:"ownerName"`
	UpdatedAt   time.Time `json:"updatedAt"`
	IdleDays    int       `json:"idleDays"`
}

// Coverage is how much of the pipeline carries the fields the money figures are
// computed from.
//
// It is part of the response rather than a footnote because the alternative is
// a page that renders a confident ₹0 for a stage whose deals simply have no
// amount typed in. The client shows a warning instead of a total when Priced is
// well below Deals.
type Coverage struct {
	Deals int `json:"deals"`
	// Priced is how many of them have a non-zero amount.
	Priced int `json:"priced"`
	// WithCameras is how many carry a camera count.
	WithCameras int `json:"withCameras"`
}

// Totals is the headline row.
type Totals struct {
	Deals int `json:"deals"`
	// Open is everything still being worked: won and the post-sale stages are
	// excluded.
	OpenCount int     `json:"openCount"`
	OpenValue float64 `json:"openValue"`
	// Won counts a deal that reached "won" and everything after it — delivery
	// and post-delivery are won deals further along, not separate outcomes.
	WonCount int     `json:"wonCount"`
	WonValue float64 `json:"wonValue"`
	// QuotedValue is the value sitting in the quote-sent column: "₹x worth of
	// quotations out".
	QuotedValue float64 `json:"quotedValue"`

	TotalCameras int `json:"totalCameras"`
	OpenCameras  int `json:"openCameras"`
	WonCameras   int `json:"wonCameras"`

	// AvgDealSize is over priced deals only — averaging in the un-priced ones
	// would report a number that falls every time someone files a deal without
	// an amount.
	AvgDealSize float64 `json:"avgDealSize"`
	// ValuePerCamera is won value over won cameras: the effective unit price,
	// and the quickest check on whether quoting is consistent.
	ValuePerCamera float64 `json:"valuePerCamera"`
	// ConversionRate is won over total, as a percentage.
	//
	// Deliberately not called "win rate": this pipeline has no lost stage, so a
	// deal that dies is either deleted or left parked in the column it stopped
	// in. The honest reading is "how much of what we opened has closed", and
	// the client labels it that way.
	ConversionRate float64 `json:"conversionRate"`
}

// Report is the whole analytics page in one response, so the page makes a
// single request rather than fanning out per tile.
type Report struct {
	GeneratedAt time.Time    `json:"generatedAt"`
	Stages      []StageRow   `json:"stages"`
	Totals      Totals       `json:"totals"`
	Owners      []OwnerRow   `json:"owners"`
	Months      []MonthRow   `json:"months"`
	Stalled     []StalledRow `json:"stalled"`
	Coverage    Coverage     `json:"coverage"`
}

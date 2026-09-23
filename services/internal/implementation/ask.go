// Package implementation backs the Implementation tab: engineering asks raised
// from a deal or lead, and the board they are worked on.
//
// It replaces Actions. The old follow_ups table is left intact — migration
// 000027 copies rather than moves.
package implementation

import (
	"errors"
	"time"
)

var (
	// ErrNotFound means no ask with that id exists in the caller's org.
	ErrNotFound = errors.New("ask not found")
	// ErrNoParent means the ask named neither a deal nor a lead.
	ErrNoParent = errors.New("an ask must belong to a deal or a lead")
	// ErrDealNotFound means the referenced deal is missing or deleted.
	ErrDealNotFound = errors.New("deal not found")
	// ErrLeadNotFound means the referenced lead is missing or deleted.
	ErrLeadNotFound = errors.New("lead not found")
	// ErrAssigneeNotFound means the assignee is not a member of the caller's org.
	ErrAssigneeNotFound = errors.New("assignee not found")
)

// Statuses is the flow, in board order: one kanban column each.
var Statuses = []string{
	"requested", "acknowledged", "in_progress", "blocked",
	"delivered", "verified", "wont_do",
}

// Priorities, most urgent first.
var Priorities = []string{"p0", "p1", "p2"}

// closedStatuses are terminal: still columns, but excluded from "open".
var closedStatuses = []string{"verified", "wont_do"}

func valid(value string, allowed []string) bool {
	for _, v := range allowed {
		if v == value {
			return true
		}
	}
	return false
}

// IsClosed reports whether a status is terminal.
func IsClosed(status string) bool { return valid(status, closedStatuses) }

// Ask is one engineering ask.
type Ask struct {
	ID    string `json:"id"`
	OrgID string `json:"orgId"`

	// One of DealID or LeadID is required. AccountID is derived from it.
	DealID    *string `json:"dealId"`
	LeadID    *string `json:"leadId"`
	AccountID *string `json:"accountId"`

	// Denormalized so a card renders without a second request.
	DealTitle   *string `json:"dealTitle"`
	LeadTitle   *string `json:"leadTitle"`
	AccountName *string `json:"accountName"`

	Title    string `json:"title"`
	Type     string `json:"type"`
	Detail   string `json:"detail"`
	Priority string `json:"priority"`
	Status   string `json:"status"`
	// Shown on the card as "Blocked · <reason>".
	BlockedReason string `json:"blockedReason"`

	AssignedTo     *string `json:"assignedTo"`
	AssignedToName *string `json:"assignedToName"`
	CreatedBy      *string `json:"createdBy"`
	CreatedByName  *string `json:"createdByName"`

	DueAt    *time.Time `json:"dueAt"`
	Position float64    `json:"position"`

	DeliveredAt *time.Time `json:"deliveredAt"`
	VerifiedAt  *time.Time `json:"verifiedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// Input is the writable shape. Status is absent: a new ask starts "requested",
// and moves go through Move, which records them.
type Input struct {
	DealID *string `json:"dealId"`
	LeadID *string `json:"leadId"`

	Title      string  `json:"title"`
	Type       string  `json:"type"`
	Detail     string  `json:"detail"`
	Priority   string  `json:"priority"`
	AssignedTo *string `json:"assignedTo"`

	DueAt *time.Time `json:"dueAt"`
}

// Move is a drag-and-drop result, or a status change from the ask itself.
type Move struct {
	Status string `json:"status"`
	// Only read when moving into "blocked".
	Reason string `json:"reason"`
	Index  int    `json:"index"`
}

// Filter narrows the board. An empty filter returns the whole board.
type Filter struct {
	DealID     string
	LeadID     string
	AccountID  string
	Status     string
	Type       string
	AssignedTo string
	// OpenOnly drops the terminal states.
	OpenOnly bool
	// Overdue keeps asks past their due date and not closed.
	Overdue bool
}

// Event is one line of an ask's history: who changed what, and when.
type Event struct {
	ID         string    `json:"id"`
	AskID      string    `json:"askId"`
	ActorID    *string   `json:"actorId"`
	ActorName  *string   `json:"actorName"`
	Kind       string    `json:"kind"`
	Field      string    `json:"field"`
	FromValue  string    `json:"fromValue"`
	ToValue    string    `json:"toValue"`
	Note       string    `json:"note"`
	OccurredAt time.Time `json:"occurredAt"`

	// orgID scopes the insert; unexported so it never reaches the wire.
	orgID string
}

// Counts drives the board header and its filter chips.
type Counts struct {
	Open     int            `json:"open"`
	Blocked  int            `json:"blocked"`
	Overdue  int            `json:"overdue"`
	Mine     int            `json:"mine"`
	ByStatus map[string]int `json:"byStatus"`
	ByType   map[string]int `json:"byType"`
}

// Board is everything the Implementation page needs in one response.
type Board struct {
	Statuses []string `json:"statuses"`
	Asks     []Ask    `json:"asks"`
	Counts   Counts   `json:"counts"`
	// Types already used here, suggested by the dialog. Still free text.
	Types []string `json:"types"`
}

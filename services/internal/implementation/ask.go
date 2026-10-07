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
	// ErrEngineerMustLinkTask means an engineer must link their card to an assigned task.
	ErrEngineerMustLinkTask = errors.New("engineers must link their card to an assigned task")
	// ErrEngineerUnassignedParent means an engineer tried to link to a task not assigned to them.
	ErrEngineerUnassignedParent = errors.New("you can only create cards linked to tasks assigned to you")
	// ErrDeleteHasSubtasks means an ask with active sub-tasks cannot be deleted.
	ErrDeleteHasSubtasks = errors.New("cannot delete an ask that has active sub-tasks; remove, complete or reassign them first")
	// ErrDeleteDeliveredForbidden means only owners and admins can delete completed or delivered asks.
	ErrDeleteDeliveredForbidden = errors.New("only owners and admins can delete delivered or verified asks")
	// ErrDeleteForbidden means the caller does not have permission to delete this ask.
	ErrDeleteForbidden = errors.New("you do not have permission to delete this ask")
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

	// One of DealID or LeadID or ParentAskID is required. AccountID is derived from it.
	DealID      *string `json:"dealId"`
	LeadID      *string `json:"leadId"`
	AccountID   *string `json:"accountId"`
	ParentAskID *string `json:"parentAskId"`

	// Denormalized so a card renders without a second request.
	DealTitle   *string `json:"dealTitle"`
	LeadTitle   *string `json:"leadTitle"`
	AccountName *string `json:"accountName"`
	ParentTitle *string `json:"parentTitle,omitempty"`
	// Locations is where the work happens, read live from the deal's sites
	// (falling back to the deal's or lead's free-text location) — never typed
	// on the ask, so it cannot drift from the deal card.
	Locations *string `json:"locations"`
	// PipelineID is the company pipeline the ask belongs to, if one exists.
	PipelineID *string `json:"pipelineId"`

	SubtaskCount     int `json:"subtaskCount"`
	SubtaskDoneCount int `json:"subtaskDoneCount"`

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
	CreatedByRole  *string `json:"createdByRole"`

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
	DealID      *string `json:"dealId"`
	LeadID      *string `json:"leadId"`
	ParentAskID *string `json:"parentAskId"`

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
	DealID       string
	LeadID       string
	AccountID    string
	ParentAskID  string
	TopLevelOnly bool
	Status       string
	Type         string
	AssignedTo   string
	AssigneeIDs  []string
	// ViewerID and ViewerRole limit the result to what that viewer may see
	// (see VisibleClause). Every read served to a user must set them.
	ViewerID   string
	ViewerRole string
	// OpenOnly drops the terminal states.
	OpenOnly bool
	// Overdue keeps asks past their due date and not closed.
	Overdue bool
}

// EngineerWorkload represents an engineer and their assigned tasks on the Manager page.
type EngineerWorkload struct {
	EngineerID    string `json:"engineerId"`
	EngineerName  string `json:"engineerName"`
	EngineerEmail string `json:"engineerEmail"`
	ActiveTasks   []Ask  `json:"activeTasks"`
	ActiveCount   int    `json:"activeCount"`
	BlockedCount  int    `json:"blockedCount"`
	DoneCount     int    `json:"doneCount"`
}

// ManagerRoster is the payload for the Manager Engineer Assignment page.
type ManagerRoster struct {
	Engineers          []EngineerWorkload `json:"engineers"`
	UnassignedSubtasks []Ask              `json:"unassignedSubtasks"`
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

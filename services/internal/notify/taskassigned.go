package notify

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/pkg/mailer"
)

// TaskAssignment is what the deal card knows at the moment a task gets an
// owner. DealID is optional: an Action can hang off a client or a lead instead,
// and the notification still makes sense without a deal to name.
type TaskAssignment struct {
	TaskID   string
	Text     string
	Priority string
	// DealID, AccountID and LeadID are the three things a task can hang off,
	// all optional. A deal-card task always has a deal; an Action may instead
	// name only a client or a lead, and saying which one is most of what makes
	// the notification worth reading.
	DealID    string
	AccountID string
	LeadID    string
	// AssigneeID is who the work landed on, and ActorID who put it there.
	AssigneeID string
	ActorID    string
}

// AssignmentChanged reports whether an assignee is worth telling.
//
// previous is nil on create, where any assignee is news. On update it is who
// held the task beforehand: the same person again means the edit was about
// something else — a rename, a tick, a due date — and re-notifying them would
// train the alert into noise within a day. Unassigning is not news either.
//
// It lives here rather than in each module because both task surfaces ask the
// identical question of the same notifier, and two copies of a rule this small
// drift without anyone noticing.
func AssignmentChanged(previous, next *string) bool {
	if next == nil {
		return false
	}
	return previous == nil || *previous != *next
}

// TaskAssigned tells someone that a task is now theirs.
//
// Only the assignee hears about it. A deal move is news to the team, but a task
// landing on one person's list is news to that person — sending it to everyone
// is how a notification bell becomes something nobody reads.
//
// Delivery happens on a detached goroutine for the same reason DealMoved's
// does: the person ticking a box should not wait on an SMTP round trip, and a
// notification that fails to send must not fail the assignment that caused it.
func (n *Notifier) TaskAssigned(ctx context.Context, orgID string, t TaskAssignment) {
	if n == nil || n.pool == nil {
		return
	}
	if t.AssigneeID == "" {
		return // nobody to tell
	}
	if t.AssigneeID == t.ActorID {
		return // they assigned it to themselves; they were there
	}

	// The request context is cancelled the moment the handler returns, so the
	// values are kept (for tracing) while the cancellation is dropped.
	sendCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sendTimeout)

	go func() {
		defer cancel()

		deal, company := n.taskContext(sendCtx, orgID, t)
		actor := n.actorName(sendCtx, t.ActorID)

		if err := n.deliver(sendCtx, NotificationItem{
			OrgID:  orgID,
			UserID: t.AssigneeID,
			Type:   "task_assigned",
			Title:  "Task assigned to you",
			Body:   taskBody(t, deal, company, actor),
			// The deal board, not a per-deal URL: no route takes a deal id yet,
			// and a link that 404s is worse than one that lands a click away.
			ActionURL: "/deals",
			Priority:  taskPriority(t.Priority),
		}); err != nil {
			log.Printf("notify: could not record task %s assignment: %v", t.TaskID, err)
			return
		}

		if n.mail == nil {
			return
		}
		to, err := n.userEmail(sendCtx, t.AssigneeID)
		if err != nil || to == "" {
			if err != nil {
				log.Printf("notify: could not resolve assignee %s: %v", t.AssigneeID, err)
			}
			return
		}
		if err := n.mail.Send(sendCtx, mailer.Message{
			To:      []string{to},
			Subject: taskSubject(t, deal),
			Body:    n.taskEmailBody(t, deal, company, actor),
		}); err != nil {
			log.Printf("notify: task %s assignment email failed: %v", t.TaskID, err)
		}
	}()
}

// taskPriority maps a task's urgency onto the four tones the bell renders.
// Only a high-priority task is worth colouring; the rest are informational.
func taskPriority(p string) string {
	if p == "high" {
		return "warning"
	}
	return "info"
}

// taskContext names what the task hangs off: its deal, and the client — falling
// back to the lead when there is no deal, which is how an Action filed against
// a lead still reads as being about someone.
//
// Every lookup is best-effort. A task with no deal, a deal with no account, or
// a row this caller may not see all produce a notification with less context
// rather than no notification.
func (n *Notifier) taskContext(ctx context.Context, orgID string, t TaskAssignment) (deal, company string) {
	if t.DealID != "" {
		deal, company = n.dealLabels(ctx, orgID, t.DealID)
	}
	if company == "" && t.AccountID != "" {
		company = n.lookup(ctx, `SELECT coalesce(name, '') FROM accounts WHERE id = $1::uuid`, t.AccountID)
	}
	if company == "" && t.LeadID != "" {
		company = n.lookup(ctx,
			`SELECT coalesce(nullif(btrim(coalesce(contact_name, '')), ''), coalesce(title, ''))
			   FROM leads WHERE id = $1::uuid`, t.LeadID)
	}
	return deal, company
}

// dealLabels reads a deal's title and client, but only for a deal that belongs
// to the caller's organization.
//
// The join through the owner is what scopes it. deals carry no org_id of their
// own, and deal_tasks are addressed by id alone, so without this a caller who
// knows a task id from another workspace could have its deal title and client
// name delivered to their own phone by assigning the task to themselves. The
// join fails closed: an unowned or foreign deal simply contributes no labels.
func (n *Notifier) dealLabels(ctx context.Context, orgID, dealID string) (deal, company string) {
	err := n.pool.QueryRow(ctx,
		`SELECT coalesce(d.title, ''), coalesce(a.name, '')
		   FROM deals d
		   JOIN users u ON u.id = d.owner_id AND u.org_id = $2::uuid
		   LEFT JOIN accounts a ON a.id = d.account_id
		  WHERE d.id = $1::uuid`, dealID, orgID).Scan(&deal, &company)
	if err != nil {
		// No row is the ordinary case for a deal outside this organization, and
		// is not worth logging as a failure.
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("notify: could not load deal %s for a task: %v", dealID, err)
		}
		return "", ""
	}
	return deal, company
}

// lookup runs a single-string query, returning "" for anything that does not
// resolve. The label is decoration on a notification that is going out either
// way, so a miss is not an error.
func (n *Notifier) lookup(ctx context.Context, query, id string) string {
	var value string
	if err := n.pool.QueryRow(ctx, query, id).Scan(&value); err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

// actorName is the display name of whoever assigned the task.
//
// Falls back to the email when the profile has no name, which is what
// details() does for a deal move — a workspace where people signed up without
// filling in a name would otherwise attribute every task to nobody. Returns ""
// only when neither exists, and the wording then drops the attribution rather
// than naming a blank.
func (n *Notifier) actorName(ctx context.Context, actorID string) string {
	if actorID == "" {
		return ""
	}
	var name string
	if err := n.pool.QueryRow(ctx,
		`SELECT coalesce(nullif(btrim(coalesce(p.full_name, '')), ''), u.email, '')
		   FROM users u
		   LEFT JOIN profiles p ON p.id = u.id
		  WHERE u.id = $1::uuid`, actorID).Scan(&name); err != nil {
		return ""
	}
	return strings.TrimSpace(name)
}

// userEmail is the address a single member is reachable at. Like orgRecipients,
// it goes through users because profiles carry no email of their own.
func (n *Notifier) userEmail(ctx context.Context, userID string) (string, error) {
	var email string
	err := n.pool.QueryRow(ctx,
		`SELECT email FROM users WHERE id = $1::uuid AND email <> ''`, userID).Scan(&email)
	return email, err
}

// taskBody is the one-line summary the bell and the push notification show.
func taskBody(t TaskAssignment, deal, company, actor string) string {
	text := strings.TrimSpace(t.Text)

	var where string
	switch {
	case company != "" && deal != "":
		where = fmt.Sprintf(" · %s, %s", company, deal)
	case deal != "":
		where = " · " + deal
	case company != "":
		where = " · " + company
	}

	if actor != "" {
		return fmt.Sprintf("%s assigned you: %s%s", actor, text, where)
	}
	return text + where
}

func taskSubject(t TaskAssignment, deal string) string {
	if deal != "" {
		return fmt.Sprintf("Task assigned to you on %s", deal)
	}
	return "A task was assigned to you"
}

// taskEmailBody spells out what the one-line body compresses, and links back
// to the app the same way the deal-moved mail does.
func (n *Notifier) taskEmailBody(t TaskAssignment, deal, company, actor string) string {
	var b strings.Builder

	if actor != "" {
		fmt.Fprintf(&b, "%s assigned a task to you.\n\n", actor)
	} else {
		b.WriteString("A task was assigned to you.\n\n")
	}

	fmt.Fprintf(&b, "Task: %s\n", strings.TrimSpace(t.Text))
	if t.Priority == "high" {
		b.WriteString("Priority: High\n")
	}
	if deal != "" {
		fmt.Fprintf(&b, "Deal: %s\n", deal)
	}
	if company != "" {
		fmt.Fprintf(&b, "Client: %s\n", company)
	}

	if n.webAppURL != "" {
		fmt.Fprintf(&b, "\n%s/deals\n", strings.TrimRight(n.webAppURL, "/"))
	}
	return b.String()
}

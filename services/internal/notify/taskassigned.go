package notify

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/go-crm/services/pkg/mailer"
)

// TaskAssignment is what the deal card knows at the moment a task gets an
// owner. DealID is optional: an Action can hang off a client or a lead instead,
// and the notification still makes sense without a deal to name.
type TaskAssignment struct {
	TaskID   string
	DealID   string
	Text     string
	Priority string
	// AssigneeID is who the work landed on, and ActorID who put it there.
	AssigneeID string
	ActorID    string
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

		deal, company := n.taskContext(sendCtx, t.DealID)
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

// taskContext looks up the deal a task hangs off, and the client it belongs to.
// Both are best-effort: a task with no deal, or a deal with no account, still
// produces a sensible notification.
func (n *Notifier) taskContext(ctx context.Context, dealID string) (deal, company string) {
	if dealID == "" {
		return "", ""
	}
	err := n.pool.QueryRow(ctx,
		`SELECT coalesce(d.title, ''), coalesce(a.name, '')
		   FROM deals d
		   LEFT JOIN accounts a ON a.id = d.account_id
		  WHERE d.id = $1::uuid`, dealID).Scan(&deal, &company)
	if err != nil {
		log.Printf("notify: could not load deal %s for a task: %v", dealID, err)
		return "", ""
	}
	return deal, company
}

// actorName is the display name of whoever assigned the task, or "" when they
// have no profile — in which case the wording drops the attribution rather than
// naming a blank.
func (n *Notifier) actorName(ctx context.Context, actorID string) string {
	if actorID == "" {
		return ""
	}
	var name *string
	if err := n.pool.QueryRow(ctx,
		`SELECT full_name FROM profiles WHERE id = $1::uuid`, actorID).Scan(&name); err != nil {
		return ""
	}
	if name == nil {
		return ""
	}
	return strings.TrimSpace(*name)
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

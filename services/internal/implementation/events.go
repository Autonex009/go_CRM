package implementation

import (
	"context"
	"log"
	"time"
)

// Event kinds.
const (
	kindCreated  = "created"
	kindStatus   = "status_changed"
	kindAssigned = "assigned"
	kindPriority = "priority_changed"
	kindDue      = "due_changed"
	kindEdited   = "edited"
	kindBlocked  = "blocked"
)

// record writes one line of history. Best effort, like activities.Log: it runs
// after the change is committed, so it must never fail the change.
func (s *store) record(ctx context.Context, e Event) {
	if e.AskID == "" || e.Kind == "" {
		return
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO ask_events (ask_id, org_id, actor_id, kind, field, from_value, to_value, note)
		 VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)`,
		e.AskID, e.orgID, nilIfEmpty(actorOf(e)), e.Kind, e.Field, e.FromValue, e.ToValue, e.Note)
	if err != nil {
		log.Printf("implementation: could not record %s on ask %s: %v", e.Kind, e.AskID, err)
	}
}

func actorOf(e Event) string {
	if e.ActorID == nil {
		return ""
	}
	return *e.ActorID
}

// events returns an ask's history, newest first.
func (s *store) events(ctx context.Context, orgID, askID string) ([]Event, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT e.id::text, e.ask_id::text, e.actor_id::text, p.full_name,
		        e.kind, e.field, e.from_value, e.to_value, e.note, e.occurred_at
		   FROM ask_events e
		   LEFT JOIN profiles p ON p.id = e.actor_id
		  WHERE e.ask_id = $2::uuid AND e.org_id = $1::uuid
		  ORDER BY e.occurred_at DESC`, orgID, askID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Event, 0, 16)
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.AskID, &e.ActorID, &e.ActorName,
			&e.Kind, &e.Field, &e.FromValue, &e.ToValue, &e.Note, &e.OccurredAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// diff turns an edit into one event per field that actually moved, so the
// history can answer "who changed the priority". Untouched fields write nothing.
func diff(before, after Ask, actorID string) []Event {
	var out []Event
	add := func(kind, field, from, to string) {
		if from == to {
			return
		}
		out = append(out, Event{
			AskID: after.ID, orgID: after.OrgID, ActorID: nilIfEmpty(actorID),
			Kind: kind, Field: field, FromValue: from, ToValue: to,
		})
	}

	add(kindEdited, "title", before.Title, after.Title)
	add(kindEdited, "type", before.Type, after.Type)
	add(kindEdited, "detail", before.Detail, after.Detail)
	add(kindPriority, "priority", before.Priority, after.Priority)
	add(kindAssigned, "assignee", label(before.AssignedToName, before.AssignedTo),
		label(after.AssignedToName, after.AssignedTo))
	add(kindDue, "dueAt", stamp(before.DueAt), stamp(after.DueAt))

	return out
}

// label prefers a name, falling back to the id.
func label(name, id *string) string {
	switch {
	case name != nil && *name != "":
		return *name
	case id != nil:
		return *id
	default:
		return ""
	}
}

func stamp(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

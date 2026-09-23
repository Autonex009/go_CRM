package implementation

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/go-crm/services/internal/activities"
	"github.com/go-crm/services/internal/notify"
	"github.com/go-crm/services/pkg/apperr"
)

// Bounds on what the dialog can send.
const (
	maxTitle  = 300
	maxDetail = 10000
)

// StatusLabel renders a status for the board and the timeline.
var StatusLabel = map[string]string{
	"requested":    "Requested",
	"acknowledged": "Acknowledged",
	"in_progress":  "In progress",
	"blocked":      "Blocked",
	"delivered":    "Delivered",
	"verified":     "Verified",
	"wont_do":      "Won't do",
}

// PriorityLabel renders a priority.
var PriorityLabel = map[string]string{"p0": "P0", "p1": "P1", "p2": "P2"}

// Service holds the Implementation business logic.
type Service struct {
	store   *store
	pool    *pgxpool.Pool
	storage *Storage
	// A nil *Notifier is usable and does nothing.
	notifier *notify.Notifier
}

// NewService exposes the service to sibling modules.
func NewService(pool *pgxpool.Pool, notifier *notify.Notifier, storage StorageConfig) *Service {
	return &Service{
		store:    &store{pool: pool},
		pool:     pool,
		storage:  NewStorage(storage),
		notifier: notifier,
	}
}

// Board returns the asks a filter admits plus the counts, in one response.
func (s *Service) Board(ctx context.Context, orgID, viewerID string, f Filter) (Board, error) {
	asks, err := s.store.list(ctx, orgID, f)
	if err != nil {
		return Board{}, err
	}
	types, err := s.store.askTypes(ctx, orgID)
	if err != nil {
		return Board{}, err
	}

	names := make([]string, 0, len(types))
	for _, t := range types {
		names = append(names, t.Name)
	}
	return Board{
		Statuses: Statuses,
		Asks:     asks,
		Counts:   tally(asks, viewerID, time.Now()),
		Types:    names,
	}, nil
}

// List is the per-deal and per-lead read the deal card uses.
func (s *Service) List(ctx context.Context, orgID string, f Filter) ([]Ask, error) {
	return s.store.list(ctx, orgID, f)
}

func (s *Service) Get(ctx context.Context, orgID, id string) (Ask, error) {
	return s.store.get(ctx, orgID, id)
}

// Events is an ask's history, newest first.
func (s *Service) Events(ctx context.Context, orgID, id string) ([]Event, error) {
	if _, err := s.store.get(ctx, orgID, id); err != nil {
		return nil, err
	}
	return s.store.events(ctx, orgID, id)
}

// Create raises an ask at "requested", then opens its history, logs the parent
// deal's timeline and notifies the assignee. None of those can fail the create.
func (s *Service) Create(ctx context.Context, orgID, actorID string, in Input) (Ask, error) {
	in, err := s.prepare(ctx, orgID, in, true)
	if err != nil {
		return Ask{}, err
	}

	a, err := s.store.create(ctx, orgID, actorID, in)
	if err != nil {
		return Ask{}, err
	}

	s.store.record(ctx, Event{
		AskID: a.ID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindCreated, ToValue: StatusLabel[a.Status],
		Note: summary(a),
	})
	s.logTimeline(ctx, orgID, actorID, a, "Implementation ask raised", summary(a))
	s.announce(ctx, orgID, actorID, a, nil)
	return a, nil
}

// Update edits the fields. Status is not one of them — see Move.
func (s *Service) Update(ctx context.Context, orgID, actorID, id string, in Input) (Ask, error) {
	in, err := s.prepare(ctx, orgID, in, false)
	if err != nil {
		return Ask{}, err
	}

	// Read before the write so the history can say what changed. A failed read
	// disqualifies the diff and the notification rather than guessing — an
	// unreadable "before" looks exactly like "nobody was assigned".
	before, readErr := s.store.get(ctx, orgID, id)

	after, err := s.store.update(ctx, orgID, id, in)
	if err != nil {
		return Ask{}, err
	}
	if readErr != nil {
		return after, nil
	}

	for _, e := range diff(before, after, actorID) {
		s.store.record(ctx, e)
	}
	s.announce(ctx, orgID, actorID, after, before.AssignedTo)
	return after, nil
}

// Move changes an ask's status. Anyone in the workspace may move any card; what
// keeps that traceable is that every move is recorded with who and when.
func (s *Service) Move(ctx context.Context, orgID, actorID, id string, mv Move) (Ask, error) {
	status := strings.TrimSpace(mv.Status)
	if !valid(status, Statuses) {
		return Ask{}, apperr.Invalid("status must be one of %s", strings.Join(Statuses, ", "))
	}
	reason := strings.TrimSpace(mv.Reason)
	if len(reason) > maxTitle {
		reason = reason[:maxTitle]
	}

	a, previous, err := s.store.move(ctx, orgID, id, status, reason)
	if err != nil {
		return Ask{}, err
	}
	if previous == status {
		return a, nil // a reorder inside a column is not a transition
	}

	s.store.record(ctx, Event{
		AskID: a.ID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind:      kindStatus,
		FromValue: StatusLabel[previous],
		ToValue:   StatusLabel[status],
		Note:      reason,
	})
	if status == "blocked" && reason != "" {
		s.store.record(ctx, Event{
			AskID: a.ID, orgID: orgID, ActorID: nilIfEmpty(actorID),
			Kind: kindBlocked, ToValue: reason,
		})
	}

	// Only the endings reach the deal timeline; every hop would bury it.
	if status == "delivered" || status == "verified" || status == "wont_do" {
		s.logTimeline(ctx, orgID, actorID, a,
			fmt.Sprintf("Implementation ask %s", strings.ToLower(StatusLabel[status])), a.Title)
	}
	return a, nil
}

// Delete removes an ask; history and attachment rows cascade.
//
// The stored files do not, so they are read before the delete and swept after
// it. A failed lookup is not fatal: the delete itself decides whether the id
// was good, and at worst a file outlives its row, as it would have before.
func (s *Service) Delete(ctx context.Context, orgID, id string) error {
	files, _ := s.store.attachments(ctx, orgID, id)
	if err := s.store.delete(ctx, orgID, id); err != nil {
		return err
	}
	// Best effort, as in Detach: the ask is already gone.
	for _, f := range files {
		_ = s.storage.Remove(ctx, f.storagePath)
	}
	return nil
}

// prepare normalises input and checks the references it names.
func (s *Service) prepare(ctx context.Context, orgID string, in Input, requireParent bool) (Input, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Type = strings.TrimSpace(in.Type)
	in.Detail = strings.TrimSpace(in.Detail)
	in.Priority = strings.TrimSpace(strings.ToLower(in.Priority))
	in.DealID = trimPtr(in.DealID)
	in.LeadID = trimPtr(in.LeadID)
	in.AssignedTo = trimPtr(in.AssignedTo)

	if in.Title == "" {
		return Input{}, apperr.Invalid("a title is required")
	}
	if len(in.Title) > maxTitle {
		return Input{}, apperr.Invalid("title must be %d characters or fewer", maxTitle)
	}
	if len(in.Detail) > maxDetail {
		return Input{}, apperr.Invalid("details must be %d characters or fewer", maxDetail)
	}
	if len(in.Type) > 80 {
		return Input{}, apperr.Invalid("type must be 80 characters or fewer")
	}
	if in.Priority == "" {
		in.Priority = "p1"
	}
	if !valid(in.Priority, Priorities) {
		return Input{}, apperr.Invalid("priority must be one of p0, p1, p2")
	}

	if requireParent {
		if in.DealID == nil && in.LeadID == nil {
			return Input{}, ErrNoParent
		}
		if in.DealID != nil {
			ok, err := s.store.dealExists(ctx, *in.DealID)
			if err != nil {
				return Input{}, err
			}
			if !ok {
				return Input{}, ErrDealNotFound
			}
		}
		if in.LeadID != nil {
			ok, err := s.store.leadExists(ctx, *in.LeadID)
			if err != nil {
				return Input{}, err
			}
			if !ok {
				return Input{}, ErrLeadNotFound
			}
		}
	}

	if in.AssignedTo != nil {
		ok, err := s.store.assigneeInOrg(ctx, orgID, *in.AssignedTo)
		if err != nil {
			return Input{}, err
		}
		if !ok {
			return Input{}, ErrAssigneeNotFound
		}
	}
	return in, nil
}

// announce notifies the assignee only when the assignment changed, through the
// same notifier the task surfaces use.
func (s *Service) announce(ctx context.Context, orgID, actorID string, a Ask, previous *string) {
	if !notify.AssignmentChanged(previous, a.AssignedTo) {
		return
	}
	s.notifier.TaskAssigned(ctx, orgID, notify.TaskAssignment{
		TaskID:     a.ID,
		Text:       a.Title,
		Priority:   notifyPriority(a.Priority),
		DealID:     deref(a.DealID),
		AccountID:  deref(a.AccountID),
		LeadID:     deref(a.LeadID),
		AssigneeID: *a.AssignedTo,
		ActorID:    actorID,
	})
}

// notifyPriority maps P0/P1/P2 onto the notifier's high/medium/normal.
func notifyPriority(p string) string {
	switch p {
	case "p0":
		return "high"
	case "p1":
		return "medium"
	default:
		return "normal"
	}
}

// logTimeline writes the deal's or lead's timeline entry. Best effort.
func (s *Service) logTimeline(ctx context.Context, orgID, actorID string, a Ask, subject, body string) {
	e := activities.Entry{
		OrgID:   orgID,
		Subject: subject,
		Body:    body,
		Actor:   actorID,
	}
	switch {
	case a.DealID != nil:
		e.DealID = *a.DealID
	case a.LeadID != nil:
		e.LeadID = *a.LeadID
	default:
		return
	}
	activities.Log(ctx, s.pool, e)
}

// summary is the one-line description the timeline and history carry.
func summary(a Ask) string {
	parts := []string{a.Title}
	if a.Type != "" {
		parts = append(parts, a.Type)
	}
	if label, ok := PriorityLabel[a.Priority]; ok {
		parts = append(parts, label)
	}
	if a.AssignedToName != nil && *a.AssignedToName != "" {
		parts = append(parts, *a.AssignedToName)
	}
	return strings.Join(parts, " · ")
}

// tally counts from the asks already loaded rather than re-querying.
func tally(asks []Ask, viewerID string, now time.Time) Counts {
	c := Counts{
		ByStatus: make(map[string]int, len(Statuses)),
		ByType:   make(map[string]int, 8),
	}
	for _, s := range Statuses {
		c.ByStatus[s] = 0
	}

	for _, a := range asks {
		// ByStatus counts every column, including the terminal ones. Everything
		// below it counts outstanding work only, so the chips agree with the
		// "N open" in the header.
		c.ByStatus[a.Status]++
		if IsClosed(a.Status) {
			continue
		}
		if a.Type != "" {
			c.ByType[a.Type]++
		}
		c.Open++
		if a.Status == "blocked" {
			c.Blocked++
		}
		if due(a, now) {
			c.Overdue++
		}
		if viewerID != "" && a.AssignedTo != nil && *a.AssignedTo == viewerID {
			c.Mine++
		}
	}
	return c
}

func trimPtr(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.TrimSpace(*v)
	if t == "" {
		return nil
	}
	return &t
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// Attach stores a file against an ask and records it in the history.
func (s *Service) Attach(ctx context.Context, orgID, actorID, askID string, a Attachment, body io.Reader) (Attachment, error) {
	if _, err := s.store.get(ctx, orgID, askID); err != nil {
		return Attachment{}, err
	}
	if !Allowed(a.FileName, a.MimeType) {
		return Attachment{}, apperr.Invalid("that file type cannot be attached")
	}

	a.storagePath = objectPath(orgID, askID, uniqueSegment(), a.FileName)
	if err := s.storage.Upload(ctx, a.storagePath, a.MimeType, body); err != nil {
		return Attachment{}, err
	}

	saved, err := s.store.addAttachment(ctx, orgID, askID, actorID, a)
	if err != nil {
		// The row is what makes the object reachable, so an object with no row
		// is litter. Sweep it rather than leaving it paid for and invisible.
		_ = s.storage.Remove(ctx, a.storagePath)
		return Attachment{}, err
	}

	s.store.record(ctx, Event{
		AskID: askID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: "attached", ToValue: saved.FileName,
	})
	return saved, nil
}

// Attachments lists an ask's files.
func (s *Service) Attachments(ctx context.Context, orgID, askID string) ([]Attachment, error) {
	if _, err := s.store.get(ctx, orgID, askID); err != nil {
		return nil, err
	}
	return s.store.attachments(ctx, orgID, askID)
}

// AttachmentURL returns a short-lived link to one file.
func (s *Service) AttachmentURL(ctx context.Context, orgID, askID, id string) (string, error) {
	a, err := s.store.attachment(ctx, orgID, askID, id)
	if err != nil {
		return "", err
	}
	return s.storage.SignedURL(ctx, a.storagePath)
}

// Rename changes an attachment's display name. The stored object is untouched,
// so links already handed out keep working.
func (s *Service) Rename(ctx context.Context, orgID, actorID, askID, id, name string) (Attachment, error) {
	name = sanitize(name)
	if name == "" {
		return Attachment{}, apperr.Invalid("a file name is required")
	}
	if !Allowed(name, "") {
		return Attachment{}, apperr.Invalid("that file extension cannot be used")
	}

	before, err := s.store.attachment(ctx, orgID, askID, id)
	if err != nil {
		return Attachment{}, err
	}
	if err := s.store.renameAttachment(ctx, orgID, askID, id, name); err != nil {
		return Attachment{}, err
	}

	s.store.record(ctx, Event{
		AskID: askID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindEdited, Field: "attachment",
		FromValue: before.FileName, ToValue: name,
	})

	after := before
	after.FileName = name
	return after, nil
}

// Detach removes a file from an ask.
func (s *Service) Detach(ctx context.Context, orgID, actorID, askID, id string) error {
	a, err := s.store.attachment(ctx, orgID, askID, id)
	if err != nil {
		return err
	}
	if err := s.store.removeAttachment(ctx, orgID, askID, id); err != nil {
		return err
	}
	// Best effort: the row is already gone, and a failed sweep must not leave
	// the caller thinking the file is still attached.
	_ = s.storage.Remove(ctx, a.storagePath)

	s.store.record(ctx, Event{
		AskID: askID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: "detached", ToValue: a.FileName,
	})
	return nil
}

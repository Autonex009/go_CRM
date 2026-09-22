package dealtasks

import (
	"context"
	"strings"

	"github.com/go-crm/services/internal/notify"
	"github.com/go-crm/services/pkg/apperr"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Priorities is the canonical order, most urgent first — the same order the
// card sorts by.
var Priorities = []string{"high", "medium", "normal"}

func validPriority(p string) bool {
	for _, v := range Priorities {
		if v == p {
			return true
		}
	}
	return false
}

// Input is the writable shape of a task. Done is only meaningful on update; a
// new task always starts open.
type Input struct {
	DealID     string  `json:"dealId"`
	Text       string  `json:"text"`
	Priority   string  `json:"priority"`
	AssignedTo *string `json:"assignedTo"`
	Done       bool    `json:"done"`
}

// Service holds the deal-task business logic.
type Service struct {
	store *store
	// notifier tells an assignee that work landed on them. A nil *Notifier is
	// usable and does nothing, so tests and a mail-less deployment need no
	// special case.
	notifier *notify.Notifier
}

func newService(pool *pgxpool.Pool, notifier *notify.Notifier) *Service {
	return &Service{store: &store{pool: pool}, notifier: notifier}
}

func (s *Service) List(ctx context.Context, dealID string) ([]Task, error) {
	return s.store.list(ctx, dealID)
}

func (s *Service) Create(ctx context.Context, orgID, actorID string, in Input) (Task, error) {
	in, err := s.prepare(ctx, orgID, in, true)
	if err != nil {
		return Task{}, err
	}
	t, err := s.store.create(ctx, in, actorID)
	if err != nil {
		return Task{}, err
	}
	s.announce(ctx, orgID, actorID, t, nil)
	return t, nil
}

func (s *Service) Update(ctx context.Context, orgID, actorID, id string, in Input) (Task, error) {
	in, err := s.prepare(ctx, orgID, in, false)
	if err != nil {
		return Task{}, err
	}

	// Read the current assignee before the write, so announce can tell a genuine
	// reassignment from an edit that left it alone.
	//
	// A read that fails is not fatal to the update — the write below reports a
	// missing row properly — but it does disqualify the notification: a
	// transient database error would otherwise look exactly like "nobody held
	// this before", and every unrelated edit would fire a fresh "assigned to
	// you". Silence is the safe wrong answer here.
	before, readErr := s.store.get(ctx, id)

	t, err := s.store.update(ctx, id, in, actorID)
	if err != nil {
		return Task{}, err
	}
	if readErr == nil {
		s.announce(ctx, orgID, actorID, t, before.AssignedTo)
	}
	return t, nil
}

// announce notifies the assignee when, and only when, the assignment changed.
//
// previous is nil on create. On update it is who held the task beforehand, so
// ticking a task done, renaming it or reprioritising it stays silent — without
// that check every edit would re-notify, and the alert would be trained into
// noise within a day.
func (s *Service) announce(ctx context.Context, orgID, actorID string, t Task, previous *string) {
	if !notify.AssignmentChanged(previous, t.AssignedTo) {
		return
	}
	s.notifier.TaskAssigned(ctx, orgID, notify.TaskAssignment{
		TaskID:     t.ID,
		DealID:     t.DealID,
		Text:       t.Text,
		Priority:   t.Priority,
		AssigneeID: *t.AssignedTo,
		ActorID:    actorID,
	})
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.store.delete(ctx, id)
}

// prepare normalizes input and checks the references it names. requireDeal is
// true on create, where the deal is part of the payload; an update never moves
// a task between deals.
func (s *Service) prepare(ctx context.Context, orgID string, in Input, requireDeal bool) (Input, error) {
	in.Text = strings.TrimSpace(in.Text)
	in.Priority = strings.TrimSpace(in.Priority)
	in.DealID = strings.TrimSpace(in.DealID)
	if in.AssignedTo != nil {
		trimmed := strings.TrimSpace(*in.AssignedTo)
		if trimmed == "" {
			in.AssignedTo = nil
		} else {
			in.AssignedTo = &trimmed
		}
	}

	if in.Text == "" {
		return Input{}, apperr.Invalid("task text is required")
	}
	if len(in.Text) > 500 {
		return Input{}, apperr.Invalid("task text must be 500 characters or fewer")
	}
	if in.Priority == "" {
		in.Priority = "normal"
	}
	if !validPriority(in.Priority) {
		return Input{}, apperr.Invalid("priority must be one of high, medium, normal")
	}

	if requireDeal {
		if in.DealID == "" {
			return Input{}, apperr.Invalid("dealId is required")
		}
		ok, err := s.store.dealExists(ctx, in.DealID)
		if err != nil {
			return Input{}, err
		}
		if !ok {
			return Input{}, ErrDealNotFound
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

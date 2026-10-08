package deals

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/pkg/apperr"
	"github.com/go-crm/services/pkg/database"
	"github.com/go-crm/services/pkg/httpx"
	"github.com/go-crm/services/pkg/middleware"
)

const (
	maxNotesLen = 20000
	// A save by the same person within this window overwrites in place;
	// anything else keeps the previous text as a revision first.
	revisionGap  = 10 * time.Minute
	maxRevisions = 50
)

// ErrNotesConflict: someone else saved since the caller last loaded the notes.
var ErrNotesConflict = errors.New("these notes were changed by someone else")

// Notes is a deal card's free-form notes.
type Notes struct {
	Notes         string     `json:"notes"`
	UpdatedAt     *time.Time `json:"updatedAt"`
	UpdatedByName *string    `json:"updatedByName"`
}

// NotesInput is an autosave. BaseUpdatedAt is the updatedAt the editor last
// saw; a mismatch means a concurrent edit and is refused, never overwritten.
type NotesInput struct {
	Notes         string     `json:"notes"`
	BaseUpdatedAt *time.Time `json:"baseUpdatedAt"`
}

type NoteRevision struct {
	ID           string     `json:"id"`
	Content      string     `json:"content"`
	EditedByName *string    `json:"editedByName"`
	EditedAt     *time.Time `json:"editedAt"`
}

// dealInOrg scopes through the owner: the production deals table has no
// org_id column. Unowned deals stay reachable, as elsewhere in this module.
const dealInOrg = `d.id = $2::uuid AND d.deleted_at IS NULL
	AND (d.owner_id IS NULL
	     OR EXISTS (SELECT 1 FROM users u WHERE u.id = d.owner_id AND u.org_id = $1::uuid))`

func (s *store) notes(ctx context.Context, orgID, id string) (Notes, error) {
	var n Notes
	err := s.pool.QueryRow(ctx,
		`SELECT d.card_notes, d.card_notes_updated_at, p.full_name
		   FROM deals d LEFT JOIN profiles p ON p.id = d.card_notes_updated_by
		  WHERE `+dealInOrg, orgID, id).Scan(&n.Notes, &n.UpdatedAt, &n.UpdatedByName)
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Notes{}, ErrNotFound
	}
	return n, err
}

// saveNotes writes the notes under a row lock, refusing a stale base and
// keeping the previous text as a revision when it is someone else's or old.
func (s *store) saveNotes(ctx context.Context, orgID, id, actorID string, in NotesInput) (Notes, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Notes{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var cur string
	var curAt *time.Time
	var curBy *string
	err = tx.QueryRow(ctx,
		`SELECT d.card_notes, d.card_notes_updated_at, d.card_notes_updated_by::text
		   FROM deals d WHERE `+dealInOrg+` FOR UPDATE`, orgID, id).Scan(&cur, &curAt, &curBy)
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Notes{}, ErrNotFound
	}
	if err != nil {
		return Notes{}, err
	}
	if !sameInstant(curAt, in.BaseUpdatedAt) {
		return Notes{}, ErrNotesConflict
	}
	if cur == in.Notes {
		return s.notes(ctx, orgID, id)
	}

	keep := cur != "" && (curBy == nil || *curBy != actorID || curAt == nil ||
		time.Since(*curAt) > revisionGap || in.Notes == "")
	if keep {
		if _, err := tx.Exec(ctx,
			`INSERT INTO deal_note_revisions (deal_id, content, edited_by, edited_at)
			 VALUES ($1::uuid, $2, $3::uuid, $4)`, id, cur, curBy, curAt); err != nil {
			return Notes{}, err
		}
	}
	if _, err := tx.Exec(ctx,
		`UPDATE deals SET card_notes = $2, card_notes_updated_at = now(),
		        card_notes_updated_by = $3::uuid
		  WHERE id = $1::uuid`, id, in.Notes, nilIfBlank(actorID)); err != nil {
		return Notes{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Notes{}, err
	}
	return s.notes(ctx, orgID, id)
}

func (s *store) noteRevisions(ctx context.Context, orgID, id string) ([]NoteRevision, error) {
	if _, err := s.notes(ctx, orgID, id); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx,
		`SELECT r.id::text, r.content, p.full_name, r.edited_at
		   FROM deal_note_revisions r LEFT JOIN profiles p ON p.id = r.edited_by
		  WHERE r.deal_id = $1::uuid
		  ORDER BY r.created_at DESC
		  LIMIT $2`, id, maxRevisions)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]NoteRevision, 0, 8)
	for rows.Next() {
		var r NoteRevision
		if err := rows.Scan(&r.ID, &r.Content, &r.EditedByName, &r.EditedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func sameInstant(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return a.Truncate(time.Microsecond).Equal(b.Truncate(time.Microsecond))
}

func nilIfBlank(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// --- service ---

func (s *Service) Notes(ctx context.Context, orgID, id string) (Notes, error) {
	return s.store.notes(ctx, orgID, id)
}

func (s *Service) SaveNotes(ctx context.Context, orgID, id, actorID string, in NotesInput) (Notes, error) {
	in.Notes = strings.TrimRight(in.Notes, " \t\r\n")
	if len([]rune(in.Notes)) > maxNotesLen {
		return Notes{}, apperr.Invalid("notes must be %d characters or fewer", maxNotesLen)
	}
	return s.store.saveNotes(ctx, orgID, id, actorID, in)
}

func (s *Service) NoteRevisions(ctx context.Context, orgID, id string) ([]NoteRevision, error) {
	return s.store.noteRevisions(ctx, orgID, id)
}

// --- handlers ---

func (h *Handler) getNotes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	n, err := h.svc.Notes(ctx, middleware.OrgID(ctx), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, err, "could not load notes")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, n)
}

func (h *Handler) saveNotes(w http.ResponseWriter, r *http.Request) {
	var in NotesInput
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	orgID, id := middleware.OrgID(ctx), chi.URLParam(r, "id")
	n, err := h.svc.SaveNotes(ctx, orgID, id, middleware.UserID(ctx), in)
	if errors.Is(err, ErrNotesConflict) {
		// Hand back what is saved now so the editor can show both versions.
		current, _ := h.svc.Notes(ctx, orgID, id)
		httpx.WriteJSON(w, http.StatusConflict, map[string]any{
			"error": ErrNotesConflict.Error(), "current": current,
		})
		return
	}
	if err != nil {
		writeErr(w, err, "could not save notes")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, n)
}

func (h *Handler) noteRevisions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	items, err := h.svc.NoteRevisions(ctx, middleware.OrgID(ctx), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, err, "could not load earlier versions")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

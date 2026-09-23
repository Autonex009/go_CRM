package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/go-crm/services/internal/notify"
	"github.com/go-crm/services/pkg/httpx"
	"github.com/go-crm/services/pkg/middleware"
)

// Handler exposes the Implementation API.
//
// No role guard: the board is the team's shared queue, and every change records
// who made it.
type Handler struct {
	svc    *Service
	secret string
}

func NewHandler(pool *pgxpool.Pool, secret string, notifier *notify.Notifier, storage StorageConfig) *Handler {
	return &Handler{svc: NewService(pool, notifier, storage), secret: secret}
}

// Routes returns the sub-router mounted at /api/v1/implementation.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireJWT(h.secret))

	r.Get("/", h.board)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Patch("/{id}", h.update)
	r.Post("/{id}/move", h.move)
	r.Get("/{id}/events", h.events)
	r.Delete("/{id}", h.remove)

	// The managed list of ask types. Ahead of /{id} so "types" is not read as
	// an ask id.
	r.Get("/types", h.listTypes)
	r.Post("/types", h.createType)
	r.Delete("/types/{typeId}", h.deleteType)

	r.Get("/{id}/attachments", h.listAttachments)
	r.Post("/{id}/attachments", h.attach)
	r.Get("/{id}/attachments/{fileId}", h.attachmentURL)
	r.Patch("/{id}/attachments/{fileId}", h.renameAttachment)
	r.Delete("/{id}/attachments/{fileId}", h.detach)

	return r
}

func (h *Handler) board(w http.ResponseWriter, r *http.Request) {
	f, ok := parseFilter(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	b, err := h.svc.Board(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), f)
	if err != nil {
		httpx.WriteServerError(w, "could not load the implementation board", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, b)
}

func parseFilter(w http.ResponseWriter, r *http.Request) (Filter, bool) {
	q := r.URL.Query()
	f := Filter{
		DealID:     q.Get("dealId"),
		LeadID:     q.Get("leadId"),
		AccountID:  q.Get("accountId"),
		Status:     q.Get("status"),
		Type:       q.Get("type"),
		AssignedTo: q.Get("assignedTo"),
		OpenOnly:   q.Get("openOnly") == "true",
		Overdue:    q.Get("overdue") == "true",
	}

	// Filters are cast to uuid in SQL, where a malformed value would surface as
	// a 500 rather than the client error it is.
	for name, value := range map[string]string{
		"dealId": f.DealID, "leadId": f.LeadID,
		"accountId": f.AccountID, "assignedTo": f.AssignedTo,
	} {
		if value != "" && !httpx.IsUUID(value) {
			httpx.WriteError(w, http.StatusBadRequest, name+" must be a UUID")
			return Filter{}, false
		}
	}
	if f.Status != "" && !valid(f.Status, Statuses) {
		httpx.WriteError(w, http.StatusBadRequest, "unknown status")
		return Filter{}, false
	}
	return f, true
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	a, err := h.svc.Get(ctx, middleware.OrgID(ctx), chi.URLParam(r, "id"))
	if err != nil {
		h.writeErr(w, err, "could not load that ask")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	a, err := h.svc.Create(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), in)
	if err != nil {
		h.writeErr(w, err, "could not create that ask")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, a)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	a, err := h.svc.Update(ctx, middleware.OrgID(ctx), middleware.UserID(ctx),
		chi.URLParam(r, "id"), in)
	if err != nil {
		h.writeErr(w, err, "could not update that ask")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
}

func (h *Handler) move(w http.ResponseWriter, r *http.Request) {
	var mv Move
	if !httpx.DecodeJSON(w, r, &mv) {
		return
	}
	ctx := r.Context()
	a, err := h.svc.Move(ctx, middleware.OrgID(ctx), middleware.UserID(ctx),
		chi.URLParam(r, "id"), mv)
	if err != nil {
		h.writeErr(w, err, "could not move that ask")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
}

func (h *Handler) events(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	items, err := h.svc.Events(ctx, middleware.OrgID(ctx), chi.URLParam(r, "id"))
	if err != nil {
		h.writeErr(w, err, "could not load that ask's history")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.svc.Delete(ctx, middleware.OrgID(ctx), chi.URLParam(r, "id")); err != nil {
		h.writeErr(w, err, "could not delete that ask")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listTypes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	items, err := h.svc.Types(ctx, middleware.OrgID(ctx))
	if err != nil {
		httpx.WriteServerError(w, "could not load ask types", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) createType(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	saved, err := h.svc.CreateType(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), in.Name)
	if err != nil {
		h.writeErr(w, err, "could not create that type")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, saved)
}

func (h *Handler) deleteType(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.svc.DeleteType(ctx, middleware.OrgID(ctx), chi.URLParam(r, "typeId")); err != nil {
		h.writeErr(w, err, "could not delete that type")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listAttachments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	items, err := h.svc.Attachments(ctx, middleware.OrgID(ctx), chi.URLParam(r, "id"))
	if err != nil {
		h.writeErr(w, err, "could not list attachments")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) attach(w http.ResponseWriter, r *http.Request) {
	// Bounded before anything is read, so an oversized upload is refused rather
	// than buffered.
	r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentBytes)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "that file is too large or the upload was malformed")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "a file is required")
		return
	}
	defer file.Close()

	ctx := r.Context()
	saved, err := h.svc.Attach(ctx, middleware.OrgID(ctx), middleware.UserID(ctx),
		chi.URLParam(r, "id"), Attachment{
			FileName:  header.Filename,
			MimeType:  header.Header.Get("Content-Type"),
			SizeBytes: header.Size,
		}, file)
	if err != nil {
		h.writeErr(w, err, "could not attach that file")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, saved)
}

func (h *Handler) attachmentURL(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	url, err := h.svc.AttachmentURL(ctx, middleware.OrgID(ctx),
		chi.URLParam(r, "id"), chi.URLParam(r, "fileId"))
	if err != nil {
		h.writeErr(w, err, "could not open that file")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (h *Handler) renameAttachment(w http.ResponseWriter, r *http.Request) {
	var in struct {
		FileName string `json:"fileName"`
	}
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	saved, err := h.svc.Rename(ctx, middleware.OrgID(ctx), middleware.UserID(ctx),
		chi.URLParam(r, "id"), chi.URLParam(r, "fileId"), in.FileName)
	if err != nil {
		h.writeErr(w, err, "could not rename that file")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, saved)
}

func (h *Handler) detach(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.svc.Detach(ctx, middleware.OrgID(ctx), middleware.UserID(ctx),
		chi.URLParam(r, "id"), chi.URLParam(r, "fileId")); err != nil {
		h.writeErr(w, err, "could not remove that file")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) writeErr(w http.ResponseWriter, err error, fallback string) {
	httpx.WriteDomainError(w, err, fallback,
		httpx.Rule{Err: ErrNotFound, Status: http.StatusNotFound, Message: "ask not found"},
		httpx.Rule{Err: ErrNoParent, Status: http.StatusBadRequest, Message: "an ask must belong to a deal or a lead"},
		httpx.Rule{Err: ErrDealNotFound, Status: http.StatusBadRequest, Message: "deal not found"},
		httpx.Rule{Err: ErrLeadNotFound, Status: http.StatusBadRequest, Message: "lead not found"},
		httpx.Rule{Err: ErrAssigneeNotFound, Status: http.StatusBadRequest, Message: "assignee not found"},
		httpx.Rule{Err: ErrStorageUnconfigured, Status: http.StatusServiceUnavailable, Message: "file attachments are not configured"},
		httpx.Rule{Err: ErrTypeExists, Status: http.StatusConflict, Message: "that type already exists"},
	)
}

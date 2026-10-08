package implementation

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/go-crm/services/pkg/httpx"
	"github.com/go-crm/services/pkg/middleware"
)

func (h *Handler) listComments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	page, err := h.svc.Comments(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"), r.URL.Query().Get("cursor"), limit)
	if err != nil {
		h.writeErr(w, err, "could not load comments")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, page)
}

func (h *Handler) addComment(w http.ResponseWriter, r *http.Request) {
	var in CommentInput
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	c, err := h.svc.AddComment(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"), in)
	if err != nil {
		h.writeErr(w, err, "could not post that comment")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, c)
}

func (h *Handler) editComment(w http.ResponseWriter, r *http.Request) {
	var in CommentInput
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	c, err := h.svc.EditComment(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"), chi.URLParam(r, "commentId"), in)
	if err != nil {
		h.writeErr(w, err, "could not edit that comment")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
}

func (h *Handler) deleteComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.svc.DeleteComment(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"), chi.URLParam(r, "commentId")); err != nil {
		h.writeErr(w, err, "could not delete that comment")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) mentionable(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	items, err := h.svc.Mentionable(ctx, middleware.OrgID(ctx), middleware.Role(ctx), chi.URLParam(r, "id"))
	if err != nil {
		h.writeErr(w, err, "could not load people to mention")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) listRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	items, err := h.svc.Requests(ctx, middleware.OrgID(ctx), middleware.Role(ctx), r.URL.Query().Get("status"))
	if err != nil {
		h.writeErr(w, err, "could not load requests")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, items)
}

func (h *Handler) review(w http.ResponseWriter, r *http.Request) {
	var in Review
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	ctx := r.Context()
	a, err := h.svc.ReviewRequest(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"), in)
	if err != nil {
		h.writeErr(w, err, "could not review that request")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
}

func (h *Handler) resubmit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	a, err := h.svc.Resubmit(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"))
	if err != nil {
		h.writeErr(w, err, "could not resubmit that request")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, shieldAsk(a, middleware.Role(ctx)))
}

func (h *Handler) linkDeal(w http.ResponseWriter, r *http.Request) {
	var in struct {
		DealID string `json:"dealId"`
	}
	if !httpx.DecodeJSON(w, r, &in) {
		return
	}
	if !httpx.IsUUID(in.DealID) {
		httpx.WriteError(w, http.StatusBadRequest, "dealId must be a UUID")
		return
	}
	ctx := r.Context()
	a, err := h.svc.LinkDeal(ctx, middleware.OrgID(ctx), middleware.UserID(ctx), middleware.Role(ctx),
		chi.URLParam(r, "id"), in.DealID)
	if err != nil {
		h.writeErr(w, err, "could not link that deal")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
}

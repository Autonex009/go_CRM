package metrics

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/go-crm/services/pkg/httpx"
	"github.com/go-crm/services/pkg/middleware"
)

// managerRoles may see the whole pipeline. Everyone else reaches the page too,
// but only ever sees their own deals — see scope below.
var managerRoles = map[string]bool{"owner": true, "admin": true, "account_manager": true}

// Handler exposes GET /api/v1/metrics.
type Handler struct {
	svc    *Service
	secret string
}

// NewHandler wires the metrics service to the pgx pool. secret is the JWT
// signing key used by the route guard.
func NewHandler(pool *pgxpool.Pool, secret string) *Handler {
	return &Handler{svc: NewService(pool), secret: secret}
}

// Routes returns the metrics sub-router, mounted at /api/v1/metrics.
//
// No RequireRole guard: unlike the Actions dashboard this is readable by the
// whole team, because a rep seeing their own numbers is the point. What a rep
// may not do is read the org's, which scope enforces on the filter rather than
// at the door.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.RequireJWT(h.secret))
	r.Get("/", h.report)
	return r
}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	f, ok := parseFilter(w, r)
	if !ok {
		return
	}

	rep, err := h.svc.Report(r.Context(), f)
	if err != nil {
		httpx.WriteServerError(w, "could not load metrics", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rep)
}

// parseFilter reads the date range and owner the page offers, then narrows the
// result to what the caller is allowed to see.
func parseFilter(w http.ResponseWriter, r *http.Request) (Filter, bool) {
	q := r.URL.Query()
	var f Filter

	if v := q.Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "from must be an RFC3339 timestamp")
			return Filter{}, false
		}
		f.From = &t
	}
	if v := q.Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "to must be an RFC3339 timestamp")
			return Filter{}, false
		}
		f.To = &t
	}
	// Cast to uuid in SQL, so a malformed value would surface as a 500 rather
	// than the client error it actually is.
	if v := q.Get("ownerId"); v != "" {
		if !httpx.IsUUID(v) {
			httpx.WriteError(w, http.StatusBadRequest, "ownerId must be a UUID")
			return Filter{}, false
		}
		f.OwnerID = v
	}

	return scope(r, f), true
}

// scope pins a rep's report to their own deals.
//
// Done here rather than in the query so there is exactly one place the rule
// lives, and so it overrides rather than merges: a rep who passes someone
// else's ownerId gets their own numbers, not an error and not the other
// person's.
func scope(r *http.Request, f Filter) Filter {
	ctx := r.Context()
	if managerRoles[middleware.Role(ctx)] {
		return f
	}
	f.OwnerID = middleware.UserID(ctx)
	return f
}

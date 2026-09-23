package dashboard

import (
	"context"
	"net/http"
	"time"

	"github.com/go-crm/services/pkg/httpx"
	"github.com/go-crm/services/pkg/middleware"
	"github.com/go-crm/services/pkg/paging"
)

const (
	activityDefaultLimit = 8
	activityMaxLimit     = 50
)

// activityEntities are the timeline filters the feed accepts, by the
// activities.entity_type they select. "all" and "implementation" are the two
// sources that are not one entity type.
var activityEntities = map[string]bool{
	"lead":    true,
	"deal":    true,
	"account": true,
	"quote":   true,
}

// ActivityItem is one row of the dashboard's activity feed.
//
// It carries both shapes: an ordinary timeline entry fills Subject and Body,
// while an implementation event also fills Field, From and To so the client can
// render "moved it from In progress to Blocked" rather than a flat sentence the
// server guessed at.
type ActivityItem struct {
	Kind      string    `json:"kind"`
	Entity    string    `json:"entity"`
	Subject   string    `json:"subject"`
	Body      string    `json:"body"`
	Actor     string    `json:"actor"`
	ActionURL string    `json:"actionUrl"`
	At        time.Time `json:"at"`

	// Set only on implementation events.
	Field string `json:"field,omitempty"`
	From  string `json:"fromValue,omitempty"`
	To    string `json:"toValue,omitempty"`
	// Context is the company or deal the ask belongs to.
	Context string `json:"context,omitempty"`
}

// ActivityPage is one page of the feed.
type ActivityPage struct {
	Items   []ActivityItem `json:"items"`
	Total   int            `json:"total"`
	HasMore bool           `json:"hasMore"`
}

// activity serves GET /api/v1/dashboard/activity.
func (h *Handler) activity(w http.ResponseWriter, r *http.Request) {
	limit, offset := paging.Params(r)
	limit, offset = paging.Clamp(limit, offset, activityDefaultLimit, activityMaxLimit)

	ctx := r.Context()
	orgID := middleware.OrgID(ctx)

	var (
		page ActivityPage
		err  error
	)
	switch source := r.URL.Query().Get("source"); {
	case source == "implementation":
		page, err = h.implementationActivity(ctx, orgID, limit, offset)
	case source == "" || source == "all":
		page, err = h.timelineActivity(ctx, orgID, "", limit, offset)
	case activityEntities[source]:
		page, err = h.timelineActivity(ctx, orgID, source, limit, offset)
	default:
		httpx.WriteError(w, http.StatusBadRequest, "unknown activity source")
		return
	}
	if err != nil {
		httpx.WriteServerError(w, "could not load activity", err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, page)
}

// timelineActivity pages the whole org's timeline — the same rows the summary's
// strip shows, without its fixed limit of six. A non-empty entity narrows it to
// one kind of record (leads, deals, ...).
func (h *Handler) timelineActivity(ctx context.Context, orgID, entity string, limit, offset int) (ActivityPage, error) {
	var page ActivityPage
	if err := h.pool.QueryRow(ctx, `
		SELECT count(*)
		  FROM activities a
		  JOIN users au ON au.id = a.author_id AND au.org_id = $1::uuid
		 WHERE ($2 = '' OR a.entity_type = $2)`,
		orgID, entity).Scan(&page.Total); err != nil {
		return ActivityPage{}, err
	}

	rows, err := h.pool.Query(ctx, `
		SELECT a.type,
		       a.entity_type,
		       coalesce(
		         d.title,
		         nullif(trim(l.contact_name), ''),
		         ac.name,
		         -- A quote has no name of its own; it is the deal's, or the account's.
		         'Quote · ' || coalesce(qd.title, qa.name),
		         initcap(a.entity_type)
		       ),
		       coalesce(a.body, ''),
		       coalesce(p.full_name, ''),
		       CASE a.entity_type
		         WHEN 'deal'    THEN '/deals'
		         WHEN 'lead'    THEN '/leads'
		         WHEN 'account' THEN '/accounts/' || a.entity_id::text
		         WHEN 'quote'   THEN '/quotes/'   || a.entity_id::text
		         ELSE ''
		       END,
		       a.occurred_at
		  FROM activities a
		  -- activities carries no org column, so the author's is what scopes it.
		  -- author_id is NOT NULL, so the inner join drops nothing. Without it a
		  -- reader pages through every workspace's timeline, not their own.
		  JOIN users au ON au.id = a.author_id AND au.org_id = $1::uuid
		  LEFT JOIN profiles p  ON p.id = a.author_id
		  LEFT JOIN deals    d  ON a.entity_type = 'deal'    AND d.id = a.entity_id
		  LEFT JOIN leads    l  ON a.entity_type = 'lead'    AND l.id = a.entity_id
		  LEFT JOIN accounts ac ON a.entity_type = 'account' AND ac.id = a.entity_id
		  LEFT JOIN quotes   q  ON a.entity_type = 'quote'   AND q.id  = a.entity_id
		  LEFT JOIN deals    qd ON qd.id = q.deal_id
		  LEFT JOIN accounts qa ON qa.id = q.account_id
		 WHERE ($2 = '' OR a.entity_type = $2)
		 ORDER BY a.occurred_at DESC, a.created_at DESC
		 LIMIT $3 OFFSET $4`, orgID, entity, limit, offset)
	if err != nil {
		return ActivityPage{}, err
	}
	defer rows.Close()

	page.Items = make([]ActivityItem, 0, limit)
	for rows.Next() {
		var it ActivityItem
		if err := rows.Scan(&it.Kind, &it.Entity, &it.Subject, &it.Body,
			&it.Actor, &it.ActionURL, &it.At); err != nil {
			return ActivityPage{}, err
		}
		page.Items = append(page.Items, it)
	}
	page.HasMore = offset+len(page.Items) < page.Total
	return page, rows.Err()
}

// implementationActivity pages every change made to an ask.
//
// This is the detailed half: ask_events records one row per field that moved,
// so a reader sees which field and what it moved between. The org's timeline
// only carries the headlines — raised, delivered, verified, dropped — which is
// what keeps a deal's story readable; the whole trail lives here instead.
func (h *Handler) implementationActivity(ctx context.Context, orgID string, limit, offset int) (ActivityPage, error) {
	var page ActivityPage
	if err := h.pool.QueryRow(ctx,
		`SELECT count(*) FROM ask_events WHERE org_id = $1::uuid`, orgID).Scan(&page.Total); err != nil {
		return ActivityPage{}, err
	}

	rows, err := h.pool.Query(ctx, `
		SELECT e.kind,
		       a.title,
		       coalesce(ac.name, d.title, l.title, ''),
		       coalesce(p.full_name, ''),
		       e.field, e.from_value, e.to_value, coalesce(e.note, ''),
		       e.occurred_at
		  FROM ask_events e
		  JOIN implementation_asks a ON a.id = e.ask_id
		  LEFT JOIN accounts ac ON ac.id = a.account_id
		  LEFT JOIN deals    d  ON d.id  = a.deal_id
		  LEFT JOIN leads    l  ON l.id  = a.lead_id
		  LEFT JOIN profiles p  ON p.id  = e.actor_id
		 WHERE e.org_id = $1::uuid
		 ORDER BY e.occurred_at DESC
		 LIMIT $2 OFFSET $3`, orgID, limit, offset)
	if err != nil {
		return ActivityPage{}, err
	}
	defer rows.Close()

	page.Items = make([]ActivityItem, 0, limit)
	for rows.Next() {
		it := ActivityItem{Entity: "ask", ActionURL: "/implementation"}
		if err := rows.Scan(&it.Kind, &it.Subject, &it.Context, &it.Actor,
			&it.Field, &it.From, &it.To, &it.Body, &it.At); err != nil {
			return ActivityPage{}, err
		}
		page.Items = append(page.Items, it)
	}
	page.HasMore = offset+len(page.Items) < page.Total
	return page, rows.Err()
}

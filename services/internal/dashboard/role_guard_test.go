package dashboard

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-crm/services/pkg/middleware"
)

func TestDashboardSummaryGuardsAgainstEngineerAndManager(t *testing.T) {
	// Build router matching Routes()
	r := chi.NewRouter()
	r.With(middleware.RequireRole("owner", "admin", "sales", "account_manager")).Get("/", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	tests := []struct {
		role       string
		wantStatus int
	}{
		{role: "engineer", wantStatus: http.StatusForbidden},
		{role: "manager", wantStatus: http.StatusForbidden},
		{role: "sales", wantStatus: http.StatusOK},
		{role: "admin", wantStatus: http.StatusOK},
		{role: "owner", wantStatus: http.StatusOK},
		{role: "account_manager", wantStatus: http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.role, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			ctx := middleware.WithRole(req.Context(), tc.role)
			req = req.WithContext(ctx)

			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("role %s: got status %d, want %d", tc.role, rec.Code, tc.wantStatus)
			}
		})
	}
}

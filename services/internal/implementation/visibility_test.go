package implementation

import (
	"strings"
	"testing"
)

func TestVisibleClause(t *testing.T) {
	tests := []struct {
		role     string
		wantNone bool
		contains []string
		excludes []string
	}{
		{role: "owner", wantNone: true},
		{role: "admin", wantNone: true},
		{role: "sales", wantNone: true},
		{role: "account_manager", wantNone: true},
		{role: "engineer", contains: []string{"a.assigned_to = $3::uuid"}, excludes: []string{"manager_id", "created_by"}},
		{role: "manager", contains: []string{"a.assigned_to = $3::uuid", "mp.manager_id = $3::uuid", "a.created_by = $3::uuid"}},
		// Unknown and client roles fail closed to the engineer rule.
		{role: "client", contains: []string{"a.assigned_to = $3::uuid"}, excludes: []string{"manager_id"}},
		{role: "", contains: []string{"a.assigned_to = $3::uuid"}, excludes: []string{"manager_id"}},
	}
	for _, tc := range tests {
		t.Run(tc.role, func(t *testing.T) {
			got := VisibleClause("a", tc.role, "$3")
			if tc.wantNone {
				if got != "" {
					t.Fatalf("role %q: want no restriction, got %q", tc.role, got)
				}
				return
			}
			for _, want := range tc.contains {
				if !strings.Contains(got, want) {
					t.Errorf("role %q: clause %q missing %q", tc.role, got, want)
				}
			}
			for _, bad := range tc.excludes {
				if strings.Contains(got, bad) {
					t.Errorf("role %q: clause %q must not contain %q", tc.role, got, bad)
				}
			}
		})
	}
}

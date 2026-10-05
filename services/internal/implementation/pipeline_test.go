package implementation

import (
	"context"
	"errors"
	"testing"
)

func TestCanManagePipelines(t *testing.T) {
	tests := []struct {
		role string
		want bool
	}{
		{"owner", true}, {"admin", true}, {"sales", true}, {"account_manager", true},
		{"manager", false}, {"engineer", false}, {"client", false}, {"", false},
	}
	for _, tc := range tests {
		if got := CanManagePipelines(tc.role); got != tc.want {
			t.Errorf("CanManagePipelines(%q) = %v, want %v", tc.role, got, tc.want)
		}
	}
}

// The role check runs before any database access, so a forbidden caller is
// refused even with no store behind the service.
func TestPipelineWritesRefuseNonCommercialRoles(t *testing.T) {
	svc := &Service{}
	for _, role := range []string{"manager", "engineer", "client", ""} {
		if _, err := svc.CreatePipeline(context.Background(), "org", "me", role,
			PipelineInput{AccountID: "acc"}); !errors.Is(err, ErrPipelineForbidden) {
			t.Errorf("create as %q: got %v, want ErrPipelineForbidden", role, err)
		}
		if _, err := svc.UpdatePipeline(context.Background(), "org", role, "id",
			PipelinePatch{}); !errors.Is(err, ErrPipelineForbidden) {
			t.Errorf("update as %q: got %v, want ErrPipelineForbidden", role, err)
		}
	}
}

func TestNormalisePatchManager(t *testing.T) {
	if normalisePatchManager(nil) != nil {
		t.Fatal("nil must stay nil (leave the manager unchanged)")
	}
	blank := "  "
	if got := normalisePatchManager(&blank); got == nil || *got != "" {
		t.Fatalf("blank must become \"\" (clear the manager), got %v", got)
	}
	id := " abc "
	if got := normalisePatchManager(&id); got == nil || *got != "abc" {
		t.Fatalf("id must be trimmed, got %v", got)
	}
}

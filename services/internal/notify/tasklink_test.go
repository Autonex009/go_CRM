package notify

import "testing"

func TestTaskLink(t *testing.T) {
	ask := TaskAssignment{TaskID: "abc-123", Kind: KindAsk}
	dealTask := TaskAssignment{TaskID: "t-1"}

	tests := []struct {
		name string
		t    TaskAssignment
		role string
		want string
	}{
		{"ask for engineer opens the card", ask, "engineer", "/implementation?ask=abc-123"},
		{"ask for manager opens the card", ask, "manager", "/implementation?ask=abc-123"},
		{"ask for sales opens the card", ask, "sales", "/implementation?ask=abc-123"},
		{"deal task for sales goes to deals", dealTask, "sales", "/deals"},
		{"deal task for owner goes to deals", dealTask, "owner", "/deals"},
		{"deal task for engineer never links deals", dealTask, "engineer", "/"},
		{"deal task for manager never links deals", dealTask, "manager", "/"},
		{"unknown role never links deals", dealTask, "", "/"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := taskLink(tc.t, tc.role); got != tc.want {
				t.Fatalf("taskLink(%+v, %q) = %q, want %q", tc.t, tc.role, got, tc.want)
			}
		})
	}
}

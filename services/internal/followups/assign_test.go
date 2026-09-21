package followups

import "testing"

func TestAssignmentChanged(t *testing.T) {
	amaan, nikhil := "amaan", "nikhil"

	cases := []struct {
		name     string
		previous *string
		next     *string
		want     bool
	}{
		{"new action with an assignee is news", nil, &amaan, true},
		{"new action with nobody on it is not", nil, nil, false},
		{"reassigned to someone else is news", &amaan, &nikhil, true},
		{"edited without touching the assignee is not", &amaan, &amaan, false},
		{"unassigning is not news", &amaan, nil, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := assignmentChanged(c.previous, c.next); got != c.want {
				t.Errorf("got %v, want %v", got, c.want)
			}
		})
	}
}

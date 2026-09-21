package notify

import (
	"context"
	"strings"
	"testing"
)

func TestTaskAssignedOnANilNotifierDoesNothing(t *testing.T) {
	// The nil *Notifier is usable by design, so no call site has to guard it.
	// If this ever panics, every deployment without a configured notifier
	// crashes on the first task assignment.
	var n *Notifier
	n.TaskAssigned(context.Background(), "org", TaskAssignment{AssigneeID: "someone"})
}

func TestTaskAssignedWithNoPoolDoesNothing(t *testing.T) {
	n := &Notifier{}
	n.TaskAssigned(context.Background(), "org", TaskAssignment{AssigneeID: "someone"})
}

func TestTaskBodyNamesTheClientAndTheDeal(t *testing.T) {
	// Arrange
	a := TaskAssignment{Text: "  Send the revised quote  "}

	// Act
	got := taskBody(a, "Mahindra rollout", "Mahindra", "Sandali Rohit")

	// Assert
	want := "Sandali Rohit assigned you: Send the revised quote · Mahindra, Mahindra rollout"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestTaskBodyWithoutAnActorDropsTheAttribution(t *testing.T) {
	// An assigner with no profile row must not produce " assigned you:".
	got := taskBody(TaskAssignment{Text: "Call the site"}, "", "", "")

	if got != "Call the site" {
		t.Errorf("got %q, want %q", got, "Call the site")
	}
	if strings.Contains(got, "assigned you") {
		t.Errorf("got %q, which names a blank assigner", got)
	}
}

func TestTaskBodyWithADealButNoClient(t *testing.T) {
	got := taskBody(TaskAssignment{Text: "Book the survey"}, "Pune warehouse", "", "Nikhil")

	want := "Nikhil assigned you: Book the survey · Pune warehouse"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestTaskPriorityOnlyColoursTheUrgentOnes(t *testing.T) {
	cases := map[string]string{
		"high":   "warning",
		"medium": "info",
		"normal": "info",
		"":       "info",
	}
	for in, want := range cases {
		if got := taskPriority(in); got != want {
			t.Errorf("taskPriority(%q): got %q, want %q", in, got, want)
		}
	}
}

func TestTaskSubjectNamesTheDealWhenThereIsOne(t *testing.T) {
	if got := taskSubject(TaskAssignment{}, "Mahindra rollout"); got != "Task assigned to you on Mahindra rollout" {
		t.Errorf("got %q", got)
	}
	// An Action can hang off a client or a lead instead, with no deal at all.
	if got := taskSubject(TaskAssignment{}, ""); got != "A task was assigned to you" {
		t.Errorf("got %q", got)
	}
}

func TestTaskEmailBodyIncludesTheLinkAndTheUrgency(t *testing.T) {
	n := &Notifier{webAppURL: "https://crm.example.com/"}

	got := n.taskEmailBody(
		TaskAssignment{Text: "Send the revised quote", Priority: "high"},
		"Mahindra rollout", "Mahindra", "Sandali Rohit")

	for _, want := range []string{
		"Sandali Rohit assigned a task to you.",
		"Task: Send the revised quote",
		"Priority: High",
		"Deal: Mahindra rollout",
		"Client: Mahindra",
		// Trailing slash trimmed, so the link is not ".com//deals".
		"https://crm.example.com/deals",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("email body is missing %q:\n%s", want, got)
		}
	}
}

func TestTaskEmailBodyOmitsPriorityWhenItIsNotHigh(t *testing.T) {
	n := &Notifier{}

	got := n.taskEmailBody(TaskAssignment{Text: "Call the site", Priority: "normal"}, "", "", "")

	if strings.Contains(got, "Priority") {
		t.Errorf("normal priority should not be spelled out:\n%s", got)
	}
}

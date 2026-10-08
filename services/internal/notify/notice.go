package notify

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/go-crm/services/pkg/mailer"
)

// Notice is one in-app notification for one person, optionally also emailed.
type Notice struct {
	UserID    string
	Type      string
	Title     string
	Body      string
	ActionURL string
	Priority  string
	Email     bool
}

// Send delivers notices in the background; failures are logged, never returned.
func (n *Notifier) Send(ctx context.Context, orgID string, notices []Notice) {
	if n == nil || n.pool == nil || len(notices) == 0 {
		return
	}
	sendCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sendTimeout)
	go func() {
		defer cancel()
		for _, nt := range notices {
			if err := n.deliver(sendCtx, NotificationItem{
				OrgID:     orgID,
				UserID:    nt.UserID,
				Type:      nt.Type,
				Title:     nt.Title,
				Body:      nt.Body,
				ActionURL: nt.ActionURL,
				Priority:  nt.Priority,
			}); err != nil {
				log.Printf("notify: could not record %s for %s: %v", nt.Type, nt.UserID, err)
				continue
			}
			if nt.Email && n.mail != nil {
				n.emailNotice(sendCtx, nt)
			}
		}
	}()
}

func (n *Notifier) emailNotice(ctx context.Context, nt Notice) {
	to, err := n.userEmail(ctx, nt.UserID)
	if err != nil || to == "" {
		return
	}
	var b strings.Builder
	b.WriteString(nt.Body)
	b.WriteString("\n")
	if n.webAppURL != "" && nt.ActionURL != "" {
		fmt.Fprintf(&b, "\nOpen it: %s/app%s\n", strings.TrimRight(n.webAppURL, "/"), nt.ActionURL)
	}
	if err := n.mail.Send(ctx, mailer.Message{To: []string{to}, Subject: nt.Title, Body: b.String()}); err != nil {
		log.Printf("notify: %s email to %s failed: %v", nt.Type, nt.UserID, err)
	}
}

// ActorName is the display name of a member, or "" if unknown.
func (n *Notifier) ActorName(ctx context.Context, userID string) string {
	if n == nil || n.pool == nil {
		return ""
	}
	return n.actorName(ctx, userID)
}

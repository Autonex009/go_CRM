package implementation

import (
	"context"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/go-crm/services/internal/notify"
)

// Comments returns one page of an ask's discussion and marks it read.
func (s *Service) Comments(ctx context.Context, orgID, viewerID, viewerRole, askID, cursor string, limit int) (CommentPage, error) {
	if viewerRole == "client" {
		return CommentPage{}, ErrClientNoComments
	}
	ask, err := s.store.get(ctx, orgID, askID)
	if err != nil {
		return CommentPage{}, err
	}
	var after *time.Time
	var afterID string
	if cursor != "" {
		t, id, err := decodeCursor(cursor)
		if err != nil {
			return CommentPage{}, err
		}
		after, afterID = &t, id
	}
	limit = clampLimit(limit)

	items, err := s.store.listComments(ctx, orgID, askID, after, afterID, limit+1)
	if err != nil {
		return CommentPage{}, err
	}
	page := CommentPage{TotalCount: ask.CommentCount}
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		next := encodeCursor(last.CreatedAt, last.ID)
		page.NextCursor = &next
	}
	for i := range items {
		redactDeleted(&items[i])
	}
	page.Comments = items

	if page.NextCursor != nil {
		return page, nil
	}
	if err := s.store.markCommentsRead(ctx, askID, viewerID); err != nil {
		log.Printf("implementation: could not mark comments read on %s: %v", askID, err)
	}
	return page, nil
}

func redactDeleted(c *Comment) {
	if !c.IsDeleted {
		return
	}
	c.Content = ""
	c.AuthorID = nil
	c.AuthorName = ""
	c.AuthorRole = ""
	c.AuthorAvatarURL = nil
	c.Mentions = []CommentMention{}
}

// AddComment posts a comment (or a reply) and notifies who needs to know.
func (s *Service) AddComment(ctx context.Context, orgID, actorID, actorRole, askID string, in CommentInput) (Comment, error) {
	if actorRole == "client" {
		return Comment{}, ErrClientNoComments
	}
	content, err := normalizeComment(in.Content)
	if err != nil {
		return Comment{}, err
	}
	ask, err := s.store.get(ctx, orgID, askID)
	if err != nil {
		return Comment{}, err
	}

	n, err := s.store.recentCommentCount(ctx, actorID, time.Now().Add(-rateWindow))
	if err != nil {
		return Comment{}, err
	}
	if n >= rateBurst {
		return Comment{}, ErrCommentRate
	}

	// Threads are one level deep: a reply to a reply joins the root's thread.
	var parent *Comment
	if id := trimPtr(in.ParentCommentID); id != nil {
		p, err := s.store.getComment(ctx, orgID, askID, *id)
		if err != nil {
			return Comment{}, err
		}
		if p.ParentCommentID != nil {
			if p, err = s.store.getComment(ctx, orgID, askID, *p.ParentCommentID); err != nil {
				return Comment{}, err
			}
		}
		parent = &p
	}

	mentions, err := s.visibleMentions(ctx, orgID, askID, actorID, content)
	if err != nil {
		return Comment{}, err
	}

	var parentID *string
	if parent != nil {
		parentID = &parent.ID
	}
	id, err := s.store.createComment(ctx, orgID, askID, actorID, parentID, content, mentions)
	if err != nil {
		return Comment{}, err
	}
	c, err := s.store.getComment(ctx, orgID, askID, id)
	if err != nil {
		return Comment{}, err
	}
	_ = s.store.markCommentsRead(ctx, askID, actorID)

	s.notifier.Send(ctx, orgID, s.visibleOnly(ctx, orgID, askID, commentNotices(ask, c, parent, mentions, actorID)))
	return c, nil
}

// visibleOnly drops recipients who can no longer see the ask (or are clients).
func (s *Service) visibleOnly(ctx context.Context, orgID, askID string, in []notify.Notice) []notify.Notice {
	if len(in) == 0 {
		return in
	}
	ids := make([]string, len(in))
	for i, n := range in {
		ids[i] = n.UserID
	}
	ok, err := s.store.mentionable(ctx, orgID, askID, ids)
	if err != nil {
		return nil
	}
	allowed := make(map[string]bool, len(ok))
	for _, m := range ok {
		allowed[m.ID] = true
	}
	out := make([]notify.Notice, 0, len(in))
	for _, n := range in {
		if allowed[n.UserID] {
			out = append(out, n)
		}
	}
	return out
}

// visibleMentions keeps only mentioned members who can see the ask, so nobody
// is notified about a task that would then 404 for them.
func (s *Service) visibleMentions(ctx context.Context, orgID, askID, actorID, content string) ([]string, error) {
	ids := parseMentions(content)
	if len(ids) == 0 {
		return []string{}, nil
	}
	ok, err := s.store.mentionable(ctx, orgID, askID, ids)
	if err != nil {
		return nil, err
	}
	allowed := make(map[string]bool, len(ok))
	for _, m := range ok {
		allowed[m.ID] = true
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if allowed[id] && id != actorID {
			out = append(out, id)
		}
	}
	return out, nil
}

// commentNotices picks recipients in priority order (mentioned, replied-to,
// assignee, creator); each person hears once and the author never does.
func commentNotices(ask Ask, c Comment, parent *Comment, mentions []string, actorID string) []notify.Notice {
	author := c.AuthorName
	if author == "" {
		author = "Someone"
	}
	link := "/implementation?ask=" + url.QueryEscape(ask.ID) + "&comment=" + url.QueryEscape(c.ID)
	body := snippet(plainText(c.Content), 160)

	sent := map[string]bool{actorID: true}
	var out []notify.Notice
	add := func(userID, typ, title, priority string, email bool) {
		if userID == "" || sent[userID] {
			return
		}
		sent[userID] = true
		out = append(out, notify.Notice{
			UserID: userID, Type: typ, Title: title, Body: body,
			ActionURL: link, Priority: priority, Email: email,
		})
	}

	for _, id := range mentions {
		add(id, "ask_comment_mention", author+" mentioned you on "+ask.Title, "warning", true)
	}
	if parent != nil && parent.AuthorID != nil && !parent.IsDeleted {
		add(*parent.AuthorID, "ask_comment_reply", author+" replied to your comment on "+ask.Title, "info", false)
	}
	if ask.AssignedTo != nil {
		add(*ask.AssignedTo, "ask_comment", author+" commented on your task: "+ask.Title, "info", false)
	}
	if ask.CreatedBy != nil {
		add(*ask.CreatedBy, "ask_comment", author+" commented on "+ask.Title, "info", false)
	}
	return out
}

func snippet(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}

// EditComment lets the author rewrite their own comment within 24 hours.
func (s *Service) EditComment(ctx context.Context, orgID, actorID, actorRole, askID, id string, in CommentInput) (Comment, error) {
	if actorRole == "client" {
		return Comment{}, ErrClientNoComments
	}
	content, err := normalizeComment(in.Content)
	if err != nil {
		return Comment{}, err
	}
	c, err := s.store.getComment(ctx, orgID, askID, id)
	if err != nil {
		return Comment{}, err
	}
	if c.IsDeleted {
		return Comment{}, ErrCommentNotFound
	}
	if err := canEditComment(c.AuthorID, actorID, c.CreatedAt, time.Now()); err != nil {
		return Comment{}, err
	}

	mentions, err := s.visibleMentions(ctx, orgID, askID, actorID, content)
	if err != nil {
		return Comment{}, err
	}
	if err := s.store.updateComment(ctx, orgID, id, content, mentions); err != nil {
		return Comment{}, err
	}
	updated, err := s.store.getComment(ctx, orgID, askID, id)
	if err != nil {
		return Comment{}, err
	}

	// Only people newly mentioned by the edit are told.
	before := map[string]bool{}
	for _, m := range c.Mentions {
		before[m.UserID] = true
	}
	var fresh []string
	for _, id := range mentions {
		if !before[id] {
			fresh = append(fresh, id)
		}
	}
	if len(fresh) > 0 {
		if ask, err := s.store.get(ctx, orgID, askID); err == nil {
			var notices []notify.Notice
			for _, n := range commentNotices(ask, updated, nil, fresh, actorID) {
				if n.Type == "ask_comment_mention" {
					notices = append(notices, n)
				}
			}
			s.notifier.Send(ctx, orgID, notices)
		}
	}
	return updated, nil
}

// DeleteComment soft-deletes: the author, or an owner/admin moderating.
func (s *Service) DeleteComment(ctx context.Context, orgID, actorID, actorRole, askID, id string) error {
	if actorRole == "client" {
		return ErrClientNoComments
	}
	c, err := s.store.getComment(ctx, orgID, askID, id)
	if err != nil {
		return err
	}
	if c.IsDeleted {
		return ErrCommentNotFound
	}
	if err := canDeleteComment(c.AuthorID, actorID, actorRole); err != nil {
		return err
	}
	if err := s.store.softDeleteComment(ctx, orgID, askID, id, actorID); err != nil {
		return err
	}
	note := "Comment deleted by its author"
	if c.AuthorID == nil || *c.AuthorID != actorID {
		note = "Comment by " + c.AuthorName + " removed by a moderator"
	}
	s.store.record(ctx, Event{
		AskID: askID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindCommentDeleted, Note: note,
	})
	return nil
}

// Mentionable lists who may be @mentioned on an ask.
func (s *Service) Mentionable(ctx context.Context, orgID, actorRole, askID string) ([]Mentionable, error) {
	if actorRole == "client" {
		return nil, ErrClientNoComments
	}
	return s.store.mentionable(ctx, orgID, askID, nil)
}

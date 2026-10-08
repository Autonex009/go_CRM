package implementation

import (
	"encoding/base64"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/go-crm/services/pkg/apperr"
)

const (
	maxCommentLen    = 5000
	commentEditLimit = 24 * time.Hour
	defaultPageSize  = 30
	maxPageSize      = 100
	// At most rateBurst comments per author within rateWindow.
	rateBurst  = 5
	rateWindow = 10 * time.Second
)

var (
	ErrCommentNotFound  = errors.New("comment not found")
	ErrCommentForbidden = errors.New("you can't change that comment")
	ErrCommentTooOld    = errors.New("comments can only be edited within 24 hours")
	ErrCommentRate      = errors.New("you're commenting too fast; wait a few seconds")
	ErrClientNoComments = errors.New("clients can't use task discussions")
)

// Comment is one message in an ask's discussion. A deleted comment keeps its
// place in a thread but carries no content or author.
type Comment struct {
	ID              string           `json:"id"`
	AskID           string           `json:"askId"`
	ParentCommentID *string          `json:"parentCommentId"`
	AuthorID        *string          `json:"authorId"`
	AuthorName      string           `json:"authorName"`
	AuthorRole      string           `json:"authorRole"`
	AuthorAvatarURL *string          `json:"authorAvatarUrl"`
	Content         string           `json:"content"`
	Mentions        []CommentMention `json:"mentions"`
	EditedAt        *time.Time       `json:"editedAt"`
	IsDeleted       bool             `json:"isDeleted"`
	CreatedAt       time.Time        `json:"createdAt"`
	UpdatedAt       time.Time        `json:"updatedAt"`
}

type CommentMention struct {
	UserID   string `json:"userId"`
	UserName string `json:"userName"`
}

type CommentInput struct {
	Content         string  `json:"content"`
	ParentCommentID *string `json:"parentCommentId"`
}

type CommentPage struct {
	Comments   []Comment `json:"comments"`
	NextCursor *string   `json:"nextCursor"`
	TotalCount int       `json:"totalCount"`
}

// Mentionable is someone who can be @mentioned on an ask.
type Mentionable struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Role      string  `json:"role"`
	AvatarURL *string `json:"avatarUrl"`
}

// mentionToken matches @[Display Name](user:<uuid>).
var mentionToken = regexp.MustCompile(`@\[([^\]\n]{1,120})\]\(user:([0-9a-fA-F-]{36})\)`)

// parseMentions returns the distinct user ids mentioned in content, in order.
func parseMentions(content string) []string {
	seen := map[string]bool{}
	var ids []string
	for _, m := range mentionToken.FindAllStringSubmatch(content, -1) {
		id := strings.ToLower(m[2])
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

// plainText renders mention tokens as "@Name", for notification bodies.
func plainText(content string) string {
	return mentionToken.ReplaceAllString(content, "@$1")
}

func normalizeComment(content string) (string, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return "", apperr.Invalid("comment cannot be empty")
	}
	if len([]rune(content)) > maxCommentLen {
		return "", apperr.Invalid("comment must be 5000 characters or fewer")
	}
	return content, nil
}

// canModerate: owners and admins may delete anyone's comment.
func canModerate(role string) bool { return role == "owner" || role == "admin" }

func canEditComment(authorID *string, actorID string, created, now time.Time) error {
	if authorID == nil || *authorID != actorID {
		return ErrCommentForbidden
	}
	if now.Sub(created) > commentEditLimit {
		return ErrCommentTooOld
	}
	return nil
}

func canDeleteComment(authorID *string, actorID, actorRole string) error {
	if canModerate(actorRole) || (authorID != nil && *authorID == actorID) {
		return nil
	}
	return ErrCommentForbidden
}

// Cursors are opaque: base64("<RFC3339Nano>|<id>") of the last row returned.
func encodeCursor(t time.Time, id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(t.UTC().Format(time.RFC3339Nano) + "|" + id))
}

func decodeCursor(c string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return time.Time{}, "", apperr.Invalid("invalid cursor")
	}
	ts, id, ok := strings.Cut(string(raw), "|")
	if !ok {
		return time.Time{}, "", apperr.Invalid("invalid cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, ts)
	if err != nil || !isUUID(id) {
		return time.Time{}, "", apperr.Invalid("invalid cursor")
	}
	return t, id, nil
}

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func isUUID(s string) bool { return uuidRe.MatchString(s) }

func clampLimit(n int) int {
	if n <= 0 {
		return defaultPageSize
	}
	if n > maxPageSize {
		return maxPageSize
	}
	return n
}

package implementation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/pkg/database"
)

const commentColumns = `
	c.id::text, c.ask_id::text, c.parent_comment_id::text, c.author_id::text,
	COALESCE(p.full_name, ''), COALESCE(p.role, ''), p.avatar_url,
	c.content, c.edited_at, c.deleted_at IS NOT NULL, c.created_at, c.updated_at`

const commentFrom = `
	FROM ask_comments c
	LEFT JOIN profiles p ON p.id = c.author_id`

func scanComment(row rowScanner) (Comment, error) {
	var c Comment
	err := row.Scan(&c.ID, &c.AskID, &c.ParentCommentID, &c.AuthorID,
		&c.AuthorName, &c.AuthorRole, &c.AuthorAvatarURL,
		&c.Content, &c.EditedAt, &c.IsDeleted, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

// listComments returns one page in thread order. A deleted comment is kept
// only while it still has live replies.
func (s *store) listComments(ctx context.Context, orgID, askID string, after *time.Time, afterID string, limit int) ([]Comment, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+commentColumns+commentFrom+`
		  WHERE c.org_id = $1::uuid AND c.ask_id = $2::uuid
		    AND (c.deleted_at IS NULL OR EXISTS (
		          SELECT 1 FROM ask_comments r
		           WHERE r.parent_comment_id = c.id AND r.deleted_at IS NULL))
		    AND ($3::timestamptz IS NULL OR (c.created_at, c.id) > ($3::timestamptz, $4::uuid))
		  ORDER BY c.created_at, c.id
		  LIMIT $5`,
		orgID, askID, after, nilIfEmpty(afterID), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Comment, 0, limit)
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, s.attachMentions(ctx, out)
}

func (s *store) attachMentions(ctx context.Context, comments []Comment) error {
	if len(comments) == 0 {
		return nil
	}
	ids := make([]string, len(comments))
	idx := make(map[string]int, len(comments))
	for i, c := range comments {
		ids[i] = c.ID
		idx[c.ID] = i
		comments[i].Mentions = []CommentMention{}
	}
	rows, err := s.pool.Query(ctx,
		`SELECT m.comment_id::text, m.mentioned_user_id::text, COALESCE(p.full_name, '')
		   FROM ask_comment_mentions m
		   LEFT JOIN profiles p ON p.id = m.mentioned_user_id
		  WHERE m.comment_id::text = ANY($1::text[])
		  ORDER BY m.created_at`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid string
		var m CommentMention
		if err := rows.Scan(&cid, &m.UserID, &m.UserName); err != nil {
			return err
		}
		comments[idx[cid]].Mentions = append(comments[idx[cid]].Mentions, m)
	}
	return rows.Err()
}

func (s *store) getComment(ctx context.Context, orgID, askID, id string) (Comment, error) {
	c, err := scanComment(s.pool.QueryRow(ctx,
		`SELECT `+commentColumns+commentFrom+`
		  WHERE c.org_id = $1::uuid AND c.ask_id = $2::uuid AND c.id = $3::uuid`,
		orgID, askID, id))
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Comment{}, ErrCommentNotFound
	}
	if err != nil {
		return Comment{}, err
	}
	list := []Comment{c}
	if err := s.attachMentions(ctx, list); err != nil {
		return Comment{}, err
	}
	return list[0], nil
}

// createComment inserts the comment, its mentions and bumps the ask's counter
// in one transaction.
func (s *store) createComment(ctx context.Context, orgID, askID, authorID string, parentID *string, content string, mentions []string) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var id string
	if err := tx.QueryRow(ctx,
		`INSERT INTO ask_comments (org_id, ask_id, parent_comment_id, author_id, content)
		 VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5)
		 RETURNING id::text`,
		orgID, askID, parentID, authorID, content).Scan(&id); err != nil {
		return "", err
	}
	if err := insertMentions(ctx, tx, orgID, id, mentions); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE implementation_asks SET comment_count = comment_count + 1
		  WHERE org_id = $1::uuid AND id = $2::uuid`, orgID, askID); err != nil {
		return "", err
	}
	return id, tx.Commit(ctx)
}

func insertMentions(ctx context.Context, tx pgx.Tx, orgID, commentID string, userIDs []string) error {
	if len(userIDs) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO ask_comment_mentions (comment_id, org_id, mentioned_user_id)
		 SELECT $1::uuid, $2::uuid, u::uuid FROM unnest($3::text[]) AS u
		 ON CONFLICT DO NOTHING`, commentID, orgID, userIDs)
	return err
}

// updateComment rewrites the text; mention rows are derived from it.
func (s *store) updateComment(ctx context.Context, orgID, id, content string, mentions []string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx,
		`UPDATE ask_comments SET content = $3, edited_at = now(), updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid AND deleted_at IS NULL`,
		orgID, id, content)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCommentNotFound
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM ask_comment_mentions
		  WHERE comment_id = $1::uuid
		    AND NOT (mentioned_user_id::text = ANY(COALESCE($2::text[], '{}')))`,
		id, mentions); err != nil {
		return err
	}
	if err := insertMentions(ctx, tx, orgID, id, mentions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// softDeleteComment hides a comment (its row and text are kept) and drops it
// from the ask's counter.
func (s *store) softDeleteComment(ctx context.Context, orgID, askID, id, actorID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx,
		`UPDATE ask_comments SET deleted_at = now(), deleted_by = $4::uuid, updated_at = now()
		  WHERE org_id = $1::uuid AND ask_id = $2::uuid AND id = $3::uuid AND deleted_at IS NULL`,
		orgID, askID, id, nilIfEmpty(actorID))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCommentNotFound
	}
	if _, err := tx.Exec(ctx,
		`UPDATE implementation_asks SET comment_count = GREATEST(comment_count - 1, 0)
		  WHERE org_id = $1::uuid AND id = $2::uuid`, orgID, askID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *store) recentCommentCount(ctx context.Context, authorID string, since time.Time) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM ask_comments WHERE author_id = $1::uuid AND created_at > $2`,
		authorID, since).Scan(&n)
	return n, err
}

func (s *store) markCommentsRead(ctx context.Context, askID, userID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO ask_comment_reads (ask_id, user_id, last_read_at)
		 VALUES ($1::uuid, $2::uuid, now())
		 ON CONFLICT (ask_id, user_id) DO UPDATE SET last_read_at = now()`, askID, userID)
	return err
}

// unreadAsks returns which of askIDs have comments from others newer than the
// viewer's last read.
func (s *store) unreadAsks(ctx context.Context, orgID, viewerID string, askIDs []string) (map[string]bool, error) {
	out := map[string]bool{}
	if viewerID == "" || len(askIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT DISTINCT c.ask_id::text
		   FROM ask_comments c
		   LEFT JOIN ask_comment_reads r ON r.ask_id = c.ask_id AND r.user_id = $2::uuid
		  WHERE c.org_id = $1::uuid
		    AND c.ask_id::text = ANY($3::text[])
		    AND c.deleted_at IS NULL
		    AND c.author_id IS DISTINCT FROM $2::uuid
		    AND c.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)`,
		orgID, viewerID, askIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// mentionable lists org members (never clients) who can see the ask. When
// only is non-empty the result is limited to those user ids.
func (s *store) mentionable(ctx context.Context, orgID, askID string, only []string) ([]Mentionable, error) {
	sql := fmt.Sprintf(`
		SELECT u.id::text,
		       COALESCE(NULLIF(btrim(p.full_name), ''), u.email),
		       COALESCE(p.role, ''), p.avatar_url
		  FROM users u
		  JOIN profiles p ON p.id = u.id
		 WHERE u.org_id = $1::uuid
		   AND p.role <> 'client'
		   AND ($3::text[] IS NULL OR u.id::text = ANY($3::text[]))
		   AND (p.role IN ('owner', 'admin', 'sales', 'account_manager')
		        OR (p.role = 'manager' AND EXISTS (
		              SELECT 1 FROM implementation_asks a
		               WHERE a.org_id = $1::uuid AND a.id = $2::uuid AND %s))
		        OR EXISTS (
		              SELECT 1 FROM implementation_asks a
		               WHERE a.org_id = $1::uuid AND a.id = $2::uuid AND %s))
		 ORDER BY 2`,
		VisibleClause("a", "manager", "u.id"), VisibleClause("a", "engineer", "u.id"))

	var filter any
	if len(only) > 0 {
		filter = only
	}
	rows, err := s.pool.Query(ctx, sql, orgID, askID, filter)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Mentionable, 0, 16)
	for rows.Next() {
		var m Mentionable
		if err := rows.Scan(&m.ID, &m.Name, &m.Role, &m.AvatarURL); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

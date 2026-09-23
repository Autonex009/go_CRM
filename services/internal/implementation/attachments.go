package implementation

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/pkg/database"
)

// Attachment is one file on an ask. The bytes live in Supabase Storage; this is
// the pointer plus what a list needs to render.
type Attachment struct {
	ID             string    `json:"id"`
	AskID          string    `json:"askId"`
	FileName       string    `json:"fileName"`
	MimeType       string    `json:"mimeType"`
	SizeBytes      int64     `json:"sizeBytes"`
	UploadedBy     *string   `json:"uploadedBy"`
	UploadedByName *string   `json:"uploadedByName"`
	CreatedAt      time.Time `json:"createdAt"`

	// storagePath stays server-side: the browser gets a signed URL instead.
	storagePath string
}

func (s *store) addAttachment(ctx context.Context, orgID, askID, actorID string, a Attachment) (Attachment, error) {
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO ask_attachments (ask_id, org_id, file_name, mime_type, size_bytes, storage_path, uploaded_by)
		 VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid)
		 RETURNING id::text`,
		askID, orgID, a.FileName, a.MimeType, a.SizeBytes, a.storagePath,
		nilIfEmpty(actorID)).Scan(&id)
	if err != nil {
		return Attachment{}, err
	}
	a.ID = id
	a.AskID = askID
	return a, nil
}

func (s *store) attachments(ctx context.Context, orgID, askID string) ([]Attachment, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT t.id::text, t.ask_id::text, t.file_name, t.mime_type, t.size_bytes,
		        t.uploaded_by::text, p.full_name, t.created_at, t.storage_path
		   FROM ask_attachments t
		   LEFT JOIN profiles p ON p.id = t.uploaded_by
		  WHERE t.org_id = $1::uuid AND t.ask_id = $2::uuid
		  ORDER BY t.created_at`, orgID, askID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Attachment, 0, 4)
	for rows.Next() {
		var a Attachment
		if err := rows.Scan(&a.ID, &a.AskID, &a.FileName, &a.MimeType, &a.SizeBytes,
			&a.UploadedBy, &a.UploadedByName, &a.CreatedAt, &a.storagePath); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *store) attachment(ctx context.Context, orgID, askID, id string) (Attachment, error) {
	var a Attachment
	err := s.pool.QueryRow(ctx,
		`SELECT t.id::text, t.ask_id::text, t.file_name, t.mime_type, t.size_bytes,
		        t.uploaded_by::text, p.full_name, t.created_at, t.storage_path
		   FROM ask_attachments t
		   LEFT JOIN profiles p ON p.id = t.uploaded_by
		  WHERE t.org_id = $1::uuid AND t.ask_id = $2::uuid AND t.id = $3::uuid`,
		orgID, askID, id).Scan(&a.ID, &a.AskID, &a.FileName, &a.MimeType, &a.SizeBytes,
		&a.UploadedBy, &a.UploadedByName, &a.CreatedAt, &a.storagePath)
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Attachment{}, ErrNotFound
	}
	return a, err
}

func (s *store) renameAttachment(ctx context.Context, orgID, askID, id, name string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE ask_attachments SET file_name = $4
		  WHERE org_id = $1::uuid AND ask_id = $2::uuid AND id = $3::uuid`,
		orgID, askID, id, name)
	if err != nil {
		if database.IsInvalidTextRepr(err) {
			return ErrNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *store) removeAttachment(ctx context.Context, orgID, askID, id string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM ask_attachments WHERE org_id = $1::uuid AND ask_id = $2::uuid AND id = $3::uuid`,
		orgID, askID, id)
	if err != nil {
		if database.IsInvalidTextRepr(err) {
			return ErrNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// uniqueSegment keeps two uploads of the same file name apart.
func uniqueSegment() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return time.Now().UTC().Format("20060102150405")
	}
	return hex.EncodeToString(b)
}

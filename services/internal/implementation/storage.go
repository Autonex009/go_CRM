package implementation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

// ErrStorageUnconfigured means no bucket credentials are set, so attachments
// are off. The rest of the module works normally without them.
var ErrStorageUnconfigured = errors.New("file storage is not configured")

// Limits on what may be attached. Both are checked before a byte is forwarded.
const (
	// Matches the bucket's own file_size_limit. Both have to agree: the gateway
	// refuses first so an oversized upload is not streamed to storage only to
	// be rejected there.
	maxAttachmentBytes = 200 << 20 // 200 MiB
	signedURLSeconds   = 300
)

// allowedTypes is what the Attach field accepts: documents and the screenshots
// that usually accompany them.
var allowedTypes = map[string]bool{
	"application/pdf":    true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
	"text/csv":   true,
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
}

var allowedExtensions = map[string]bool{
	".pdf": true, ".doc": true, ".docx": true, ".xls": true, ".xlsx": true,
	".csv": true, ".png": true, ".jpg": true, ".jpeg": true, ".webp": true,
}

// StorageConfig points at a Supabase Storage bucket. An empty BaseURL or
// SecretKey disables attachments.
type StorageConfig struct {
	BaseURL string
	// SecretKey is an sb_secret_... key or a legacy service_role JWT — one that
	// bypasses RLS. A publishable key cannot work here: the bucket is private
	// and carries no policies, so every request it made would be denied.
	SecretKey string
	Bucket    string
}

// Storage talks to Supabase Storage over its REST API.
//
// The secret key never leaves the gateway: the browser uploads to us and we
// forward, and downloads go through a signed URL that expires. A key handed to
// the page would grant the whole bucket to anyone who opened devtools.
type Storage struct {
	cfg    StorageConfig
	client *http.Client
}

func NewStorage(cfg StorageConfig) *Storage {
	if cfg.Bucket == "" {
		cfg.Bucket = "implementation-attachments"
	}
	return &Storage{cfg: cfg, client: &http.Client{Timeout: 60 * time.Second}}
}

func (s *Storage) enabled() bool {
	return s != nil && s.cfg.BaseURL != "" && s.cfg.SecretKey != ""
}

// auth sets both headers Supabase accepts. The newer sb_secret_... keys are
// sent as apikey; a legacy service_role JWT goes in Authorization. Setting both
// means either style of key works without the caller knowing which it holds.
func (s *Storage) auth(req *http.Request) {
	req.Header.Set("apikey", s.cfg.SecretKey)
	req.Header.Set("Authorization", "Bearer "+s.cfg.SecretKey)
}

// objectPath is {org_id}/{ask_id}/{unique}-{file_name}, so one ask's files sit
// together and no two uploads collide.
func objectPath(orgID, askID, unique, fileName string) string {
	return fmt.Sprintf("%s/%s/%s-%s", orgID, askID, unique, sanitize(fileName))
}

// sanitize keeps a recognisable file name while removing anything that would
// change the meaning of the path.
func sanitize(name string) string {
	name = path.Base(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, "\\", "-")
	if name == "" || name == "." || name == ".." {
		return "file"
	}
	if len(name) > 120 {
		name = name[len(name)-120:]
	}
	return name
}

// Allowed reports whether a file may be attached.
//
// The extension decides. A browser sends whatever Content-Type it likes, so
// trusting the declared type alone would let any file through by calling itself
// a PDF; the type is checked only as a second gate on what the extension let in.
func Allowed(fileName, mimeType string) bool {
	if !allowedExtensions[strings.ToLower(path.Ext(fileName))] {
		return false
	}
	mime := strings.ToLower(strings.TrimSpace(mimeType))
	if i := strings.IndexByte(mime, ';'); i >= 0 {
		mime = strings.TrimSpace(mime[:i])
	}
	// An empty or generic type is normal from some clients, and the extension
	// has already vouched for the file.
	return mime == "" || mime == "application/octet-stream" || allowedTypes[mime]
}

// Upload stores the bytes and returns the object path recorded against the ask.
func (s *Storage) Upload(ctx context.Context, objPath, mimeType string, body io.Reader) error {
	if !s.enabled() {
		return ErrStorageUnconfigured
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.objectURL("object", objPath), body)
	if err != nil {
		return err
	}
	s.auth(req)
	req.Header.Set("Content-Type", defaultType(mimeType))
	// Refuse rather than overwrite: a colliding path means the unique segment
	// repeated, which is a bug worth surfacing, not a file to silently replace.
	req.Header.Set("x-upsert", "false")

	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("storage upload failed: %s", status(res))
	}
	return nil
}

// SignedURL returns a short-lived link the browser can open directly.
func (s *Storage) SignedURL(ctx context.Context, objPath string) (string, error) {
	if !s.enabled() {
		return "", ErrStorageUnconfigured
	}

	payload, _ := json.Marshal(map[string]int{"expiresIn": signedURLSeconds})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.objectURL("object/sign", objPath), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	s.auth(req)
	req.Header.Set("Content-Type", "application/json")

	res, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("storage sign failed: %s", status(res))
	}

	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return "", err
	}
	// Supabase returns a path relative to /storage/v1.
	return strings.TrimRight(s.cfg.BaseURL, "/") + "/storage/v1" + out.SignedURL, nil
}

// Remove deletes the object. Best effort at the call site: the row is gone
// either way, and an orphaned object is swept rather than blocking the delete.
func (s *Storage) Remove(ctx context.Context, objPath string) error {
	if !s.enabled() {
		return ErrStorageUnconfigured
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, s.objectURL("object", objPath), nil)
	if err != nil {
		return err
	}
	s.auth(req)

	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("storage delete failed: %s", status(res))
	}
	return nil
}

func (s *Storage) objectURL(kind, objPath string) string {
	parts := strings.Split(objPath, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return fmt.Sprintf("%s/storage/v1/%s/%s/%s",
		strings.TrimRight(s.cfg.BaseURL, "/"), kind, s.cfg.Bucket, strings.Join(parts, "/"))
}

func defaultType(mimeType string) string {
	if mimeType == "" {
		return "application/octet-stream"
	}
	return mimeType
}

func status(res *http.Response) string {
	body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
	return fmt.Sprintf("%s %s", res.Status, strings.TrimSpace(string(body)))
}

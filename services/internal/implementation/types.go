package implementation

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/go-crm/services/pkg/apperr"
	"github.com/go-crm/services/pkg/database"
)

// ErrTypeExists means the workspace already has a type by that name.
var ErrTypeExists = errors.New("that type already exists")

// maxTypeName bounds a type name. It is a dropdown label, not a description.
const maxTypeName = 60

// AskType is one entry in a workspace's list of ask types.
type AskType struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	// InUse is how many asks currently carry this type, so the client can warn
	// before removing one that is being used.
	InUse int `json:"inUse"`
}

func (s *store) askTypes(ctx context.Context, orgID string) ([]AskType, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT t.id::text, t.name, t.created_at,
		        (SELECT count(*) FROM implementation_asks a
		          WHERE a.org_id = t.org_id
		            AND lower(btrim(a.type)) = lower(btrim(t.name)))::int
		   FROM ask_types t
		  WHERE t.org_id = $1::uuid
		  ORDER BY lower(t.name)`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AskType, 0, 8)
	for rows.Next() {
		var t AskType
		if err := rows.Scan(&t.ID, &t.Name, &t.CreatedAt, &t.InUse); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *store) createAskType(ctx context.Context, orgID, actorID, name string) (AskType, error) {
	var t AskType
	err := s.pool.QueryRow(ctx,
		`INSERT INTO ask_types (org_id, name, created_by)
		 VALUES ($1::uuid, $2, $3::uuid)
		 RETURNING id::text, name, created_at`,
		orgID, name, nilIfEmpty(actorID)).Scan(&t.ID, &t.Name, &t.CreatedAt)
	if err != nil {
		if database.IsUniqueViolation(err) {
			return AskType{}, ErrTypeExists
		}
		return AskType{}, err
	}
	return t, nil
}

func (s *store) deleteAskType(ctx context.Context, orgID, id string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM ask_types WHERE org_id = $1::uuid AND id = $2::uuid`, orgID, id)
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

// Types lists the workspace's ask types.
func (s *Service) Types(ctx context.Context, orgID string) ([]AskType, error) {
	return s.store.askTypes(ctx, orgID)
}

// CreateType adds a type to the list.
func (s *Service) CreateType(ctx context.Context, orgID, actorID, name string) (AskType, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return AskType{}, apperr.Invalid("a type name is required")
	}
	if len(name) > maxTypeName {
		return AskType{}, apperr.Invalid("a type name must be %d characters or fewer", maxTypeName)
	}
	return s.store.createAskType(ctx, orgID, actorID, name)
}

// DeleteType removes a type from the list.
//
// Asks already carrying it keep their string: the type column is free text on
// purpose, so removing a label from the dropdown never rewrites history.
func (s *Service) DeleteType(ctx context.Context, orgID, id string) error {
	return s.store.deleteAskType(ctx, orgID, id)
}

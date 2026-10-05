package implementation

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/pkg/apperr"
	"github.com/go-crm/services/pkg/database"
)

var (
	// ErrPipelineNotFound means no pipeline with that id exists in the org.
	ErrPipelineNotFound = errors.New("pipeline not found")
	// ErrPipelineExists means the company already has a pipeline.
	ErrPipelineExists = errors.New("that company already has a pipeline")
	// ErrPipelineForbidden means the caller's role may not manage pipelines.
	ErrPipelineForbidden = errors.New("only admin, sales or account managers can manage pipelines")
	// ErrCompanyNotFound means the company is missing, deleted or in another org.
	ErrCompanyNotFound = errors.New("company not found")
	// ErrManagerNotFound means the named manager is not a manager in the org.
	ErrManagerNotFound = errors.New("engineering manager not found")
)

const maxPipelineDescription = 2000

// Pipeline is one company's kanban on the Implementation tab. Its asks are the
// ones carrying the same account_id; nothing on the ask points here.
type Pipeline struct {
	ID          string  `json:"id"`
	AccountID   string  `json:"accountId"`
	AccountName string  `json:"accountName"`
	ManagerID   *string `json:"managerId"`
	ManagerName *string `json:"managerName"`
	Description string  `json:"description"`
	// Locations is the company's sites as its deals name them, name and city
	// only — the same source the cards read.
	Locations  *string    `json:"locations"`
	ArchivedAt *time.Time `json:"archivedAt"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

// PipelineInput creates a pipeline.
type PipelineInput struct {
	AccountID   string  `json:"accountId"`
	ManagerID   *string `json:"managerId"`
	Description string  `json:"description"`
}

// PipelinePatch changes a pipeline. Nil fields are left as they are; an empty
// ManagerID clears the manager.
type PipelinePatch struct {
	ManagerID   *string `json:"managerId"`
	Description *string `json:"description"`
	Archived    *bool   `json:"archived"`
}

// CanManagePipelines reports whether a role may create, reassign or archive a
// pipeline. Managers run the cards inside one; they do not create them.
func CanManagePipelines(role string) bool { return fullAccessRoles[role] }

const pipelineColumns = `
	pl.id::text, pl.account_id::text, ac.name,
	pl.manager_id::text, pm.full_name,
	pl.description,
	(SELECT string_agg(DISTINCT
	          al.name || CASE
	            WHEN NULLIF(btrim(al.city), '') IS NOT NULL
	             AND lower(btrim(al.city)) <> lower(btrim(al.name))
	            THEN ' (' || btrim(al.city) || ')' ELSE '' END, '; ')
	   FROM deals pd
	   JOIN deal_locations dl ON dl.deal_id = pd.id
	   JOIN account_locations al ON al.id = dl.location_id
	  WHERE pd.account_id = pl.account_id AND pd.deleted_at IS NULL
	    AND pd.owner_id IN (SELECT ou.id FROM users ou WHERE ou.org_id = pl.org_id)),
	pl.archived_at, pl.created_at, pl.updated_at`

const pipelineFrom = `
	FROM implementation_pipelines pl
	JOIN accounts ac ON ac.id = pl.account_id
	LEFT JOIN profiles pm ON pm.id = pl.manager_id `

func scanPipeline(row rowScanner) (Pipeline, error) {
	var p Pipeline
	err := row.Scan(&p.ID, &p.AccountID, &p.AccountName,
		&p.ManagerID, &p.ManagerName, &p.Description, &p.Locations,
		&p.ArchivedAt, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

// pipelines lists the org's pipelines a viewer may see: all of them for a
// full-access role; otherwise those holding an ask the viewer can see, plus,
// for a manager, the ones they manage even while still empty.
func (s *store) pipelines(ctx context.Context, orgID, viewerID, viewerRole string) ([]Pipeline, error) {
	cond := ` WHERE pl.org_id = $1::uuid`
	args := []any{orgID}
	if clause := VisibleClause("a", viewerRole, "$2"); clause != "" {
		args = append(args, viewerID)
		cond += ` AND (EXISTS (
		              SELECT 1 FROM implementation_asks a
		               WHERE a.org_id = pl.org_id AND a.account_id = pl.account_id
		                 AND (a.deal_id IS NULL OR EXISTS (
		                      SELECT 1 FROM deals xd WHERE xd.id = a.deal_id AND xd.deleted_at IS NULL))
		                 AND (a.lead_id IS NULL OR EXISTS (
		                      SELECT 1 FROM leads xl WHERE xl.id = a.lead_id AND xl.deleted_at IS NULL))
		                 AND ` + clause + `)`
		if viewerRole == "manager" {
			cond += ` OR pl.manager_id = $2::uuid`
		}
		cond += `)`
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+pipelineColumns+pipelineFrom+cond+` ORDER BY lower(ac.name)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Pipeline, 0, 16)
	for rows.Next() {
		p, err := scanPipeline(rows)
		if err != nil {
			return nil, err
		}
		// A scoped viewer sees only the sites of the asks they can see: the
		// board derives those from the cards, so the company-wide list —
		// every deal's sites — is withheld rather than leaked.
		if !fullAccessRoles[viewerRole] {
			p.Locations = nil
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *store) pipeline(ctx context.Context, orgID, id string) (Pipeline, error) {
	p, err := scanPipeline(s.pool.QueryRow(ctx,
		`SELECT `+pipelineColumns+pipelineFrom+
			` WHERE pl.org_id = $1::uuid AND pl.id = $2::uuid`, orgID, id))
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return Pipeline{}, ErrPipelineNotFound
	}
	return p, err
}

// companyInOrg checks a live company belongs to the org. accounts carry no
// org_id, so membership is read the ways the org is already tied to it: its
// owner is a member (as in notify.dealLabels), or the org already has asks or
// deals for it — an owner who has since left must not orphan a client.
func (s *store) companyInOrg(ctx context.Context, orgID, accountID string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (
		     SELECT 1 FROM accounts ac
		      WHERE ac.id = $2::uuid AND ac.deleted_at IS NULL
		        AND (EXISTS (SELECT 1 FROM users u
		                      WHERE u.id = ac.owner_id AND u.org_id = $1::uuid)
		          OR EXISTS (SELECT 1 FROM implementation_asks ia
		                      WHERE ia.account_id = ac.id AND ia.org_id = $1::uuid)
		          OR EXISTS (SELECT 1 FROM deals d
		                       JOIN users du ON du.id = d.owner_id AND du.org_id = $1::uuid
		                      WHERE d.account_id = ac.id AND d.deleted_at IS NULL)))`,
		orgID, accountID).Scan(&ok)
	if err != nil && database.IsInvalidTextRepr(err) {
		return false, nil
	}
	return ok, err
}

// managerInOrg checks the profile is an engineering manager in the org.
func (s *store) managerInOrg(ctx context.Context, orgID, userID string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (
		     SELECT 1 FROM users u JOIN profiles p ON p.id = u.id
		      WHERE u.org_id = $1::uuid AND u.id = $2::uuid AND p.role = 'manager')`,
		orgID, userID).Scan(&ok)
	if err != nil && database.IsInvalidTextRepr(err) {
		return false, nil
	}
	return ok, err
}

func (s *store) createPipeline(ctx context.Context, orgID, actorID string, in PipelineInput) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO implementation_pipelines (org_id, account_id, manager_id, description, created_by)
		 VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid)
		 RETURNING id::text`,
		orgID, in.AccountID, in.ManagerID, in.Description, nilIfEmpty(actorID)).Scan(&id)
	if database.IsUniqueViolation(err) {
		return "", ErrPipelineExists
	}
	return id, err
}

// updatePipeline writes only the fields the patch names.
func (s *store) updatePipeline(ctx context.Context, orgID, id string, p PipelinePatch) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE implementation_pipelines
		    SET manager_id  = CASE WHEN $3::bool THEN $4::uuid ELSE manager_id END,
		        description = COALESCE($5, description),
		        archived_at = CASE
		                        WHEN $6::bool IS NULL THEN archived_at
		                        WHEN $6::bool THEN COALESCE(archived_at, now())
		                        ELSE NULL END,
		        updated_at  = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid`,
		orgID, id, p.ManagerID != nil, trimPtr(p.ManagerID), p.Description, p.Archived)
	if err != nil {
		if database.IsInvalidTextRepr(err) {
			return ErrPipelineNotFound
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrPipelineNotFound
	}
	return nil
}

// ensurePipeline gives an ask's company a pipeline if it has none, so a new
// ask never lands outside one — and reopens an archived one, since new work
// for a company must not be hidden on arrival. A no-op for an ask with no
// company; an active pipeline is left untouched.
func (s *store) ensurePipeline(ctx context.Context, orgID, askID, actorID string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO implementation_pipelines (org_id, account_id, created_by)
		 SELECT a.org_id, a.account_id, $3::uuid
		   FROM implementation_asks a
		  WHERE a.org_id = $1::uuid AND a.id = $2::uuid AND a.account_id IS NOT NULL
		 ON CONFLICT (org_id, account_id) DO UPDATE
		    SET archived_at = NULL, updated_at = now()
		  WHERE implementation_pipelines.archived_at IS NOT NULL`,
		orgID, askID, nilIfEmpty(actorID))
	return err
}

// Pipelines lists the pipelines the viewer may see.
func (s *Service) Pipelines(ctx context.Context, orgID, viewerID, viewerRole string) ([]Pipeline, error) {
	return s.store.pipelines(ctx, orgID, viewerID, viewerRole)
}

// CreatePipeline opens a company's pipeline. Admin, sales and account managers
// only.
func (s *Service) CreatePipeline(ctx context.Context, orgID, actorID, actorRole string, in PipelineInput) (Pipeline, error) {
	if !CanManagePipelines(actorRole) {
		return Pipeline{}, ErrPipelineForbidden
	}
	in.AccountID = strings.TrimSpace(in.AccountID)
	in.ManagerID = trimPtr(in.ManagerID)
	in.Description = strings.TrimSpace(in.Description)
	if in.AccountID == "" {
		return Pipeline{}, apperr.Invalid("pick a company")
	}
	if len(in.Description) > maxPipelineDescription {
		return Pipeline{}, apperr.Invalid("description must be %d characters or fewer", maxPipelineDescription)
	}
	if ok, err := s.store.companyInOrg(ctx, orgID, in.AccountID); err != nil {
		return Pipeline{}, err
	} else if !ok {
		return Pipeline{}, ErrCompanyNotFound
	}
	if err := s.checkManager(ctx, orgID, in.ManagerID); err != nil {
		return Pipeline{}, err
	}

	id, err := s.store.createPipeline(ctx, orgID, actorID, in)
	if err != nil {
		return Pipeline{}, err
	}
	return s.store.pipeline(ctx, orgID, id)
}

// UpdatePipeline reassigns, describes or archives a pipeline. Archiving hides
// it from the board; nothing is deleted.
func (s *Service) UpdatePipeline(ctx context.Context, orgID, actorRole, id string, p PipelinePatch) (Pipeline, error) {
	if !CanManagePipelines(actorRole) {
		return Pipeline{}, ErrPipelineForbidden
	}
	p.ManagerID = normalisePatchManager(p.ManagerID)
	if p.Description != nil {
		d := strings.TrimSpace(*p.Description)
		if len(d) > maxPipelineDescription {
			return Pipeline{}, apperr.Invalid("description must be %d characters or fewer", maxPipelineDescription)
		}
		p.Description = &d
	}
	if p.ManagerID != nil && *p.ManagerID != "" {
		if err := s.checkManager(ctx, orgID, p.ManagerID); err != nil {
			return Pipeline{}, err
		}
	}
	if err := s.store.updatePipeline(ctx, orgID, id, p); err != nil {
		return Pipeline{}, err
	}
	return s.store.pipeline(ctx, orgID, id)
}

// normalisePatchManager keeps "clear the manager" (an empty string) distinct
// from "leave it" (nil), trimming whitespace either way.
func normalisePatchManager(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.TrimSpace(*v)
	return &t
}

func (s *Service) checkManager(ctx context.Context, orgID string, managerID *string) error {
	if managerID == nil || *managerID == "" {
		return nil
	}
	ok, err := s.store.managerInOrg(ctx, orgID, *managerID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrManagerNotFound
	}
	return nil
}

// ensurePipelineFor is the best-effort hook Create calls: the ask is already
// saved, so a failure here is logged rather than failing it — the board still
// groups the ask under its company.
func (s *Service) ensurePipelineFor(ctx context.Context, orgID, askID, actorID string) {
	if err := s.store.ensurePipeline(ctx, orgID, askID, actorID); err != nil {
		log.Printf("implementation: could not open a pipeline for ask %s: %v", askID, err)
	}
}

package implementation

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/internal/notify"
	"github.com/go-crm/services/pkg/apperr"
	"github.com/go-crm/services/pkg/database"
)

const untitledRequest = "Untitled request"

var reviewStatuses = []string{"pending", "approved", "rejected"}

var (
	ErrReviewForbidden   = errors.New("only owners, admins, sales and account managers can review requests")
	ErrNotPending        = errors.New("this request is not awaiting review")
	ErrNotRejected       = errors.New("only a rejected request can be resubmitted")
	ErrNotARequest       = errors.New("this ask is not a request")
	ErrResubmitForbidden = errors.New("only the manager who raised this request can resubmit it")
	ErrLinkPending       = errors.New("approve the request to link its deal")
	ErrDealNoCompany     = errors.New("that deal has no company; set the deal's company first")
	ErrDealInactive      = errors.New("only active deals can be linked")
)

// Review is a reviewer's decision on a pending request.
type Review struct {
	Action string  `json:"action"` // approve | reject
	DealID *string `json:"dealId"`
	Note   string  `json:"note"`
}

// isRequestCreate: every top-level ask a manager raises goes through review.
func isRequestCreate(actorRole string, in Input) bool {
	return actorRole == "manager" && trimPtr(in.ParentAskID) == nil
}

// createRequest saves a manager's ask as a pending request. Every field is
// optional; the reviewer completes it and links the deal.
func (s *Service) createRequest(ctx context.Context, orgID, actorID string, in Input) (Ask, error) {
	in.DealID, in.LeadID, in.ParentAskID = nil, nil, nil
	if strings.TrimSpace(in.Title) == "" {
		in.Title = untitledRequest
	}
	in, err := s.prepare(ctx, orgID, in, false)
	if err != nil {
		return Ask{}, err
	}
	if in.AccountID != nil {
		ok, err := s.store.companyInOrg(ctx, orgID, *in.AccountID)
		if err != nil {
			return Ask{}, err
		}
		if !ok {
			return Ask{}, ErrCompanyNotFound
		}
	}

	a, err := s.store.create(ctx, orgID, actorID, in, true)
	if err != nil {
		return Ask{}, err
	}
	a = s.placeInPipeline(ctx, orgID, actorID, a)

	s.store.record(ctx, Event{
		AskID: a.ID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindCreated, ToValue: StatusLabel[a.Status], Note: summary(a),
	})
	s.store.record(ctx, Event{
		AskID: a.ID, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindSubmitted, ToValue: "Pending review",
	})
	s.logTimeline(ctx, orgID, actorID, a, "Implementation request raised", summary(a))
	s.announce(ctx, orgID, actorID, a, nil)
	s.notifyReviewers(ctx, orgID, actorID, a)
	return a, nil
}

// Requests lists manager requests for the Deals page review queue.
func (s *Service) Requests(ctx context.Context, orgID, actorRole, status string) ([]Ask, error) {
	if !fullAccessRoles[actorRole] {
		return nil, ErrReviewForbidden
	}
	if status == "" {
		status = "pending"
	}
	if !valid(status, reviewStatuses) {
		return nil, apperr.Invalid("status must be one of pending, approved, rejected")
	}
	return s.store.list(ctx, orgID, Filter{ReviewStatus: status})
}

// ReviewRequest approves (linking a deal) or rejects a pending request.
func (s *Service) ReviewRequest(ctx context.Context, orgID, actorID, actorRole, id string, r Review) (Ask, error) {
	if !fullAccessRoles[actorRole] {
		return Ask{}, ErrReviewForbidden
	}
	ask, err := s.store.get(ctx, orgID, id)
	if err != nil {
		return Ask{}, err
	}
	if ask.ReviewStatus == nil || *ask.ReviewStatus != "pending" {
		return Ask{}, ErrNotPending
	}
	note := strings.TrimSpace(r.Note)
	if len(note) > maxDetail {
		return Ask{}, apperr.Invalid("note must be %d characters or fewer", maxDetail)
	}

	switch r.Action {
	case "approve":
		dealID := trimPtr(r.DealID)
		if dealID == nil {
			return Ask{}, apperr.Invalid("choose the deal this request belongs to")
		}
		if err := s.store.approveRequest(ctx, orgID, id, *dealID, actorID, note); err != nil {
			return Ask{}, err
		}
	case "reject":
		if note == "" {
			return Ask{}, apperr.Invalid("a reason is required to reject a request")
		}
		if err := s.store.setReview(ctx, orgID, id, "pending", "rejected", actorID, note); err != nil {
			return Ask{}, err
		}
	default:
		return Ask{}, apperr.Invalid("action must be approve or reject")
	}

	after, err := s.store.get(ctx, orgID, id)
	if err != nil {
		return Ask{}, err
	}
	after = s.placeInPipeline(ctx, orgID, actorID, after)

	if r.Action == "approve" {
		s.store.record(ctx, Event{AskID: id, orgID: orgID, ActorID: nilIfEmpty(actorID),
			Kind: kindApproved, ToValue: "Approved", Note: note})
		s.store.record(ctx, Event{AskID: id, orgID: orgID, ActorID: nilIfEmpty(actorID),
			Kind: kindDealLinked, ToValue: deref(after.DealTitle)})
		s.logTimeline(ctx, orgID, actorID, after, "Implementation request approved", summary(after))
	} else {
		s.store.record(ctx, Event{AskID: id, orgID: orgID, ActorID: nilIfEmpty(actorID),
			Kind: kindRejected, ToValue: "Rejected", Note: note})
	}
	s.notifyRequester(ctx, orgID, actorID, after, r.Action)
	return after, nil
}

// Resubmit sends a rejected request back for review.
func (s *Service) Resubmit(ctx context.Context, orgID, actorID, actorRole, id string) (Ask, error) {
	if actorRole != "manager" && !fullAccessRoles[actorRole] {
		return Ask{}, ErrResubmitForbidden
	}
	ask, err := s.store.get(ctx, orgID, id)
	if err != nil {
		return Ask{}, err
	}
	if actorRole == "manager" && (ask.CreatedBy == nil || *ask.CreatedBy != actorID) {
		return Ask{}, ErrResubmitForbidden
	}
	if ask.ReviewStatus == nil {
		return Ask{}, ErrNotARequest
	}
	if *ask.ReviewStatus != "rejected" {
		return Ask{}, ErrNotRejected
	}
	if err := s.store.resubmit(ctx, orgID, id, actorID); err != nil {
		return Ask{}, err
	}
	after, err := s.store.get(ctx, orgID, id)
	if err != nil {
		return Ask{}, err
	}
	s.store.record(ctx, Event{AskID: id, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindSubmitted, ToValue: "Pending review", Note: "Resubmitted"})
	s.notifyReviewers(ctx, orgID, actorID, after)
	return after, nil
}

// LinkDeal re-points an existing ask (and its unlinked sub-tasks) at a deal.
func (s *Service) LinkDeal(ctx context.Context, orgID, actorID, actorRole, id, dealID string) (Ask, error) {
	if !fullAccessRoles[actorRole] {
		return Ask{}, ErrReviewForbidden
	}
	before, err := s.store.get(ctx, orgID, id)
	if err != nil {
		return Ask{}, err
	}
	if before.ReviewStatus != nil && *before.ReviewStatus != "approved" {
		return Ask{}, ErrLinkPending
	}
	if err := s.store.linkDeal(ctx, orgID, id, dealID); err != nil {
		return Ask{}, err
	}
	after, err := s.store.get(ctx, orgID, id)
	if err != nil {
		return Ask{}, err
	}
	after = s.placeInPipeline(ctx, orgID, actorID, after)
	s.store.record(ctx, Event{AskID: id, orgID: orgID, ActorID: nilIfEmpty(actorID),
		Kind: kindDealLinked, FromValue: deref(before.DealTitle), ToValue: deref(after.DealTitle)})
	return after, nil
}

// placeInPipeline makes sure the ask's company has an open pipeline (re-opening
// an archived one) so the card shows in that company's section.
func (s *Service) placeInPipeline(ctx context.Context, orgID, actorID string, a Ask) Ask {
	if a.AccountID == nil {
		return a
	}
	s.ensurePipelineFor(ctx, orgID, a.ID, actorID)
	if fresh, err := s.store.get(ctx, orgID, a.ID); err == nil {
		return fresh
	}
	return a
}

func (s *Service) notifyReviewers(ctx context.Context, orgID, actorID string, a Ask) {
	ids, err := s.store.reviewers(ctx, orgID, a.AccountID)
	if err != nil {
		return
	}
	who := s.notifier.ActorName(ctx, actorID)
	if who == "" {
		who = "A manager"
	}
	var out []notify.Notice
	for _, id := range ids {
		if id == actorID {
			continue
		}
		out = append(out, notify.Notice{
			UserID: id, Type: "ask_request_submitted",
			Title:     who + " requested an implementation ask",
			Body:      a.Title,
			ActionURL: "/requests?request=" + url.QueryEscape(a.ID),
			Priority:  "warning",
		})
	}
	s.notifier.Send(ctx, orgID, out)
}

func (s *Service) notifyRequester(ctx context.Context, orgID, actorID string, a Ask, action string) {
	if a.CreatedBy == nil || *a.CreatedBy == actorID {
		return
	}
	title := "Your request was approved: " + a.Title
	typ := "ask_request_approved"
	if action == "reject" {
		title = "Your request was sent back: " + a.Title
		typ = "ask_request_rejected"
	}
	s.notifier.Send(ctx, orgID, []notify.Notice{{
		UserID: *a.CreatedBy, Type: typ, Title: title, Body: a.ReviewNote,
		ActionURL: "/implementation?ask=" + url.QueryEscape(a.ID),
		Priority:  "info", Email: true,
	}})
}

// --- store ---

// dealInOrgSQL scopes through the owner, like companyInOrg: the production
// deals table has no org_id column. Unowned deals stay reachable, as before.
const dealInOrgSQL = `
	SELECT d.account_id::text FROM deals d
	 WHERE d.id = $2::uuid AND d.deleted_at IS NULL
	   AND (d.owner_id IS NULL
	        OR EXISTS (SELECT 1 FROM users u WHERE u.id = d.owner_id AND u.org_id = $1::uuid))`

func (s *store) approveRequest(ctx context.Context, orgID, id, dealID, actorID, note string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := linkDealTx(ctx, tx, orgID, id, dealID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx,
		`UPDATE implementation_asks
		    SET review_status = 'approved', reviewed_by = $3::uuid, reviewed_at = now(),
		        review_note = $4, updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid AND review_status = 'pending'`,
		orgID, id, nilIfEmpty(actorID), note)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotPending
	}
	return tx.Commit(ctx)
}

func (s *store) linkDeal(ctx context.Context, orgID, id, dealID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := linkDealTx(ctx, tx, orgID, id, dealID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// linkDealTx sets the deal (and the company it implies) on the ask and on any
// sub-task not already linked to a deal.
func linkDealTx(ctx context.Context, tx pgx.Tx, orgID, id, dealID string) error {
	var account *string
	err := tx.QueryRow(ctx, dealInOrgSQL, orgID, dealID).Scan(&account)
	if errors.Is(err, pgx.ErrNoRows) || database.IsInvalidTextRepr(err) {
		return ErrDealNotFound
	}
	if err != nil {
		return err
	}
	var lost bool
	if err := tx.QueryRow(ctx, `SELECT stage = 'lost' FROM deals WHERE id = $1::uuid`, dealID).Scan(&lost); err != nil {
		return err
	}
	if lost {
		return ErrDealInactive
	}
	// Sub-tasks still on the ask's previous deal follow it to the new one.
	var oldDeal *string
	if err := tx.QueryRow(ctx,
		`SELECT deal_id::text FROM implementation_asks WHERE org_id = $1::uuid AND id = $2::uuid`,
		orgID, id).Scan(&oldDeal); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	var company *string
	err = tx.QueryRow(ctx,
		`UPDATE implementation_asks
		    SET deal_id = $3::uuid, account_id = COALESCE($4::uuid, account_id), updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid
		 RETURNING account_id::text`,
		orgID, id, dealID, account).Scan(&company)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	// The card must land in a company pipeline, so a company is required.
	if company == nil {
		return ErrDealNoCompany
	}
	// Sub-tasks always move with the parent's company; their deal follows when
	// they had none or shared the parent's old one.
	_, err = tx.Exec(ctx,
		`UPDATE implementation_asks
		    SET deal_id = CASE WHEN deal_id IS NULL OR deal_id = $5::uuid THEN $3::uuid ELSE deal_id END,
		        account_id = COALESCE($4::uuid, account_id), updated_at = now()
		  WHERE org_id = $1::uuid AND parent_ask_id = $2::uuid`,
		orgID, id, dealID, account, oldDeal)
	return err
}

func (s *store) setReview(ctx context.Context, orgID, id, from, to, actorID, note string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE implementation_asks
		    SET review_status = $4, reviewed_by = $5::uuid, reviewed_at = now(),
		        review_note = $6, updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid AND review_status = $3`,
		orgID, id, from, to, nilIfEmpty(actorID), note)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotPending
	}
	return nil
}

func (s *store) resubmit(ctx context.Context, orgID, id, actorID string) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE implementation_asks
		    SET review_status = 'pending', submitted_by = $3::uuid, submitted_at = now(),
		        updated_at = now()
		  WHERE org_id = $1::uuid AND id = $2::uuid AND review_status = 'rejected'`,
		orgID, id, nilIfEmpty(actorID))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotRejected
	}
	return nil
}

// reviewers: the org's owners and admins, plus the company's owner when they
// are on the GTM team (only GTM can open the requests page).
func (s *store) reviewers(ctx context.Context, orgID string, accountID *string) ([]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT u.id::text FROM users u JOIN profiles p ON p.id = u.id
		  WHERE u.org_id = $1::uuid
		    AND (p.role IN ('owner', 'admin')
		         OR (p.role IN ('sales', 'account_manager')
		             AND u.id = (SELECT owner_id FROM accounts WHERE id = $2::uuid)))`,
		orgID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

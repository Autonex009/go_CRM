package auth

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/go-crm/services/pkg/config"
)

// ErrNotInvited is returned when an SSO identity passes the domain check but is
// not a member of the workspace and has no invitation waiting.
//
// This is the difference between "who works here" and "who has an email address
// here". The domain allow-list is the second, and on its own it means every
// account the Google Workspace will ever contain — including ones created after
// this deployment, and including shared or service mailboxes — can sign in and
// be provisioned into the organization automatically.
var ErrNotInvited = errors.New("this account has not been given access to the workspace")

// admission decides whether a first-time SSO identity may join, and which
// organization it joins.
//
// Three outcomes, and the first that applies wins:
//
//  1. An unaccepted, unexpired invitation exists for the address → admit into
//     that invitation's organization and consume it. This is what makes the
//     invite flow in Team & Settings the allow-list: to give someone access you
//     invite them, and their first Google sign-in completes the onboarding with
//     no password ever being set.
//  2. SSO_AUTO_PROVISION is on → admit into the default organization, which is
//     the old behaviour, kept for a deployment that wants an open door.
//  3. Otherwise → ErrNotInvited.
//
// Existing members never reach here: they are matched by provider id or email
// earlier in the SSO flow. So this governs new people only, which is the whole
// question being asked.
type admission struct {
	// orgID is the organization to create the user in. Empty means the caller's
	// configured default.
	orgID string
	// invitationID is set when an invitation was consumed, so the caller can
	// attribute it once the user row exists.
	invitationID string
}

// invitationFor finds an open invitation for an address.
//
// Expiry and prior acceptance are both part of the query rather than checked
// afterwards: an invitation that has been used, or has run out, is not an
// invitation, and an admission path is the wrong place to be lenient.
func (s *store) invitationFor(ctx context.Context, email string) (admission, error) {
	var a admission
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, org_id::text
		   FROM invitations
		  WHERE lower(btrim(email)) = $1
		    AND accepted_at IS NULL
		    AND expires_at > now()
		  ORDER BY created_at DESC
		  LIMIT 1`, email).Scan(&a.invitationID, &a.orgID)
	if errors.Is(err, pgx.ErrNoRows) {
		return admission{}, ErrNotInvited
	}
	if err != nil {
		return admission{}, err
	}
	return a, nil
}

// consumeInvitation marks the invitation accepted.
//
// Called after the user row exists, and deliberately not fatal if it fails: the
// person is already in the workspace by then, and refusing them a session over
// a bookkeeping write would be the worse outcome. A stale pending invitation
// shows up in Team & Settings and can be revoked there.
func (s *store) consumeInvitation(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE invitations SET accepted_at = now()
		  WHERE id = $1 AND accepted_at IS NULL`, id)
	return err
}

// admit resolves where a first-time SSO identity may go, or refuses it.
func (s *Service) admit(ctx context.Context, email string) (admission, error) {
	found, err := s.store.invitationFor(ctx, email)
	return decide(found, err, s.cfg)
}

// decide is the rule itself, lifted out of the lookup.
//
// Separated so it can be read in one screen and tested without a database — and
// tested as the code that actually runs, rather than as a copy of it that could
// drift.
func decide(found admission, lookupErr error, cfg config.Config) (admission, error) {
	if lookupErr == nil {
		return found, nil // invited: their invitation names the organization
	}

	// A lookup that failed for any other reason must not read as "not invited".
	// Treated as a refusal it would lock out a legitimate member; treated as one
	// on an open deployment it would admit a stranger on a database blip.
	if !errors.Is(lookupErr, ErrNotInvited) {
		return admission{}, lookupErr
	}

	if cfg.SSOAutoProvision {
		return admission{orgID: cfg.SSODefaultOrgID}, nil
	}
	return admission{}, ErrNotInvited
}

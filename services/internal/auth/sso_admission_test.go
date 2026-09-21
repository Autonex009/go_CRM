package auth

import (
	"errors"
	"testing"

	"github.com/go-crm/services/pkg/config"
)

// The domain check and the membership check answer different questions, and the
// first is not a substitute for the second: every mailbox the Google Workspace
// will ever contain passes it.
func TestDomainAllowedIsNotMembership(t *testing.T) {
	allowed := []string{"autonexai360.com"}

	// A colleague who has never been given access still clears the domain gate.
	if !domainAllowed(allowed, "someone.new@autonexai360.com") {
		t.Fatal("domainAllowed rejected an address on the allowed domain")
	}
	// Which is why admission is a second, separate decision.
}

func TestDomainAllowedRejectsOtherDomains(t *testing.T) {
	allowed := []string{"autonexai360.com"}

	for _, email := range []string{
		"outsider@gmail.com",
		"lookalike@autonexai360.com.attacker.test",
		"autonexai360.com@gmail.com",
		"noatsign",
		"trailing@",
	} {
		if domainAllowed(allowed, email) {
			t.Errorf("domainAllowed(%q) = true, want false", email)
		}
	}
}

// An empty list stays permissive so a deployment that never set
// SSO_ALLOWED_DOMAINS is unchanged.
func TestDomainAllowedEmptyListPermitsAll(t *testing.T) {
	if !domainAllowed(nil, "anyone@anywhere.test") {
		t.Error("an empty allow-list should permit every domain")
	}
}

// Closed is the default: a config with nothing set must not provision.
func TestAutoProvisionDefaultsOff(t *testing.T) {
	var cfg config.Config
	if cfg.SSOAutoProvision {
		t.Error("SSOAutoProvision defaults to true; it must default to closed")
	}
}

// With auto-provisioning on, an uninvited address is admitted to the default
// organization — the old behaviour, still reachable deliberately.
func TestDecideOpenDeploymentAdmitsToTheDefaultOrg(t *testing.T) {
	const org = "11111111-1111-1111-1111-111111111111"
	cfg := config.Config{SSOAutoProvision: true, SSODefaultOrgID: org}

	a, err := decide(admission{}, ErrNotInvited, cfg)
	if err != nil {
		t.Fatalf("admit refused an open deployment: %v", err)
	}
	if a.orgID != org {
		t.Errorf("orgID = %q, want the configured default %q", a.orgID, org)
	}
	if a.invitationID != "" {
		t.Errorf("invitationID = %q, want empty when no invitation was used", a.invitationID)
	}
}

// Closed deployment, no invitation: refused, and refused with the error the
// handler turns into "ask an admin to invite you".
func TestDecideClosedDeploymentRefusesTheUninvited(t *testing.T) {
	cfg := config.Config{SSODefaultOrgID: "whatever"}

	if _, err := decide(admission{}, ErrNotInvited, cfg); !errors.Is(err, ErrNotInvited) {
		t.Fatalf("admit returned %v, want ErrNotInvited", err)
	}
}

// A lookup failure must not be mistaken for "not invited" and quietly lock
// someone out — or, worse with auto-provision on, let them in.
func TestDecidePropagatesALookupFailure(t *testing.T) {
	boom := errors.New("connection reset")
	cfg := config.Config{SSOAutoProvision: true}

	_, err := decide(admission{}, boom, cfg)
	if !errors.Is(err, boom) {
		t.Fatalf("admit returned %v, want the underlying lookup error", err)
	}
}

// An invitation names the organization, and it must win over the configured
// default: someone invited into a workspace has to land in that one.
func TestDecideInvitationOrgWins(t *testing.T) {
	cfg := config.Config{SSODefaultOrgID: "the-default-org"}
	invited := admission{orgID: "the-inviting-org", invitationID: "inv-1"}

	a, err := decide(invited, nil, cfg)
	if err != nil {
		t.Fatalf("decide refused an invited address: %v", err)
	}
	if a.orgID != "the-inviting-org" {
		t.Errorf("orgID = %q, want the inviting organization", a.orgID)
	}
	if a.invitationID != "inv-1" {
		t.Errorf("invitationID = %q, want it carried through for consumption", a.invitationID)
	}
}

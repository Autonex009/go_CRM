package auth

import (
	"errors"
	"strings"
)

// ErrWrongPortal: valid credentials used on another role's sign-in tab.
var ErrWrongPortal = errors.New("this account signs in through a different portal")

const (
	PortalAdmin    = "admin"
	PortalManager  = "manager"
	PortalEngineer = "engineer"
)

// portalRoles is who each sign-in tab admits.
var portalRoles = map[string][]string{
	PortalAdmin:    {"owner", "admin", "sales", "account_manager"},
	PortalManager:  {"manager"},
	PortalEngineer: {"engineer", "client"},
}

func normalizePortal(p string) string {
	p = strings.ToLower(strings.TrimSpace(p))
	if _, ok := portalRoles[p]; ok {
		return p
	}
	return ""
}

// checkPortal accepts an empty portal so API clients without tabs keep working.
func checkPortal(portal, role string) error {
	portal = normalizePortal(portal)
	if portal == "" {
		return nil
	}
	for _, r := range portalRoles[portal] {
		if r == role {
			return nil
		}
	}
	return wrongPortalError{role: role}
}

type wrongPortalError struct{ role string }

func (e wrongPortalError) Error() string        { return wrongPortalMessage(e.role) }
func (e wrongPortalError) Is(target error) bool { return target == ErrWrongPortal }

func portalFor(role string) string {
	for p, roles := range portalRoles {
		for _, r := range roles {
			if r == role {
				return p
			}
		}
	}
	return ""
}

func wrongPortalMessage(role string) string {
	label := map[string]string{
		PortalAdmin:    "Leadership",
		PortalManager:  "Manager",
		PortalEngineer: "Engineer",
	}[portalFor(role)]
	if label == "" {
		label = "correct"
	}
	return "This account can't sign in here. Use the " + label + " tab to sign in."
}

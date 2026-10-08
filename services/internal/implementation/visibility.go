package implementation

import "fmt"

// fullAccessRoles see every ask in the workspace.
var fullAccessRoles = map[string]bool{
	"owner": true, "admin": true, "sales": true, "account_manager": true,
}

// VisibleClause is the SQL predicate limiting asks (aliased alias) to the ones
// a viewer may see. ref is the placeholder holding the viewer's id, e.g. "$3".
// It returns "" for roles that see everything.
//
//   - an engineer sees only what is assigned to them;
//   - a manager sees what is assigned to them or to the engineers reporting to
//     them, plus unassigned asks they raised or whose parent is their
//     team's, plus every ask in an active company pipeline they manage — never
//     another manager's or another team's work outside those.
//
// Any role not named here gets the engineer rule, so a new or unexpected role
// fails closed rather than seeing the whole board.
func VisibleClause(alias, role, ref string) string {
	if fullAccessRoles[role] {
		return ""
	}
	if role == "manager" {
		team := fmt.Sprintf(`(SELECT mp.id FROM profiles mp WHERE mp.manager_id = %s::uuid)`, ref)
		return fmt.Sprintf(`(%[1]s.assigned_to = %[2]s::uuid
		   OR %[1]s.assigned_to IN %[3]s
		   OR %[1]s.created_by = %[2]s::uuid
		   OR %[1]s.account_id IN (
		        SELECT ip.account_id FROM implementation_pipelines ip
		         WHERE ip.org_id = %[1]s.org_id AND ip.manager_id = %[2]s::uuid
		           AND ip.archived_at IS NULL)
		   OR (%[1]s.assigned_to IS NULL AND %[1]s.parent_ask_id IN (
		        SELECT vp.id FROM implementation_asks vp
		         WHERE vp.assigned_to = %[2]s::uuid OR vp.assigned_to IN %[3]s)))`, alias, ref, team)
	}
	return fmt.Sprintf(`(%[1]s.assigned_to = %[2]s::uuid
	   OR %[1]s.id IN (
	        SELECT vp.parent_ask_id FROM implementation_asks vp
	         WHERE vp.parent_ask_id IS NOT NULL AND vp.assigned_to = %[2]s::uuid))`, alias, ref)
}

// shieldAsk hides commercial links (deal, lead) from roles outside the GTM
// team; engineers and engineering managers see the work, not the deal.
func shieldAsk(a Ask, role string) Ask {
	if fullAccessRoles[role] {
		return a
	}
	a.DealID, a.LeadID, a.DealTitle, a.LeadTitle = nil, nil, nil, nil
	return a
}

func shieldAsks(asks []Ask, role string) []Ask {
	if fullAccessRoles[role] {
		return asks
	}
	out := make([]Ask, len(asks))
	for i, a := range asks {
		out[i] = shieldAsk(a, role)
	}
	return out
}

// shieldEvents blanks deal names recorded in history for the same roles.
func shieldEvents(events []Event, role string) []Event {
	if fullAccessRoles[role] {
		return events
	}
	out := make([]Event, len(events))
	for i, e := range events {
		if e.Kind == kindDealLinked {
			e.FromValue, e.ToValue = "", ""
		}
		out[i] = e
	}
	return out
}

import type { AssigneeGroup } from "../ui";
import { memberLabel, type Member } from "./api";

/**
 * The people who run commercial records — leads, deals, companies, quotes,
 * invoices and deal tasks. Engineering managers and engineers are assigned
 * work only on the Implementation board and the Engineer Tasks page.
 */
export const COMMERCIAL_ROLES = ["owner", "admin", "sales", "account_manager"];

/** Group order and headings for people pickers. */
const ROLE_GROUPS: { roles: string[]; label: string }[] = [
  { roles: ["manager"], label: "Managers" },
  { roles: ["engineer"], label: "Engineers" },
  { roles: ["account_manager"], label: "Account managers" },
  { roles: ["sales"], label: "Sales" },
  { roles: ["owner", "admin"], label: "Owners & admins" },
];

interface MemberGroupOptions {
  /** Leave this member out, e.g. an engineer cannot manage themselves. */
  exclude?: string;
  /** Offer only members with these roles. */
  roles?: string[];
  /**
   * Always show this member (the record's current assignee), even when their
   * role is no longer offered — otherwise the field would read "Unassigned"
   * and the next save would silently clear a real owner.
   */
  keep?: string | null;
}

/**
 * Members as picker groups, one per role, so a long list reads as "who does
 * what" rather than one undifferentiated column of names. Members with a role
 * not listed above land in "Others". The email is the second line, which tells
 * apart two people with the same name.
 */
export function memberGroups(members: Member[], options: MemberGroupOptions = {}): AssigneeGroup[] {
  const { exclude, roles, keep } = options;
  const pool = members.filter(
    (m) => m.id !== exclude && (!roles || roles.includes(m.role ?? "")),
  );

  const claimed = new Set<string>();
  const out: AssigneeGroup[] = [];
  for (const g of ROLE_GROUPS) {
    const people = pool.filter((m) => g.roles.includes(m.role ?? ""));
    people.forEach((m) => claimed.add(m.id));
    if (people.length > 0) out.push({ label: g.label, options: people.map(toOption) });
  }
  const rest = pool.filter((m) => !claimed.has(m.id));
  if (rest.length > 0) out.push({ label: "Others", options: rest.map(toOption) });

  if (keep && !pool.some((m) => m.id === keep)) {
    const current = members.find((m) => m.id === keep);
    if (current) out.unshift({ label: "Current", options: [toOption(current)] });
  }
  return out;
}

function toOption(m: Member) {
  const name = memberLabel(m);
  return { id: m.id, name, hint: name === m.email ? undefined : m.email };
}

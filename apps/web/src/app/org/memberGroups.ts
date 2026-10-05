import type { AssigneeGroup } from "../ui";
import { memberLabel, type Member } from "./api";

/** Group order and headings for people pickers. */
const ROLE_GROUPS: { roles: string[]; label: string }[] = [
  { roles: ["manager"], label: "Managers" },
  { roles: ["engineer"], label: "Engineers" },
  { roles: ["account_manager"], label: "Account managers" },
  { roles: ["sales"], label: "Sales" },
  { roles: ["owner", "admin"], label: "Owners & admins" },
];

/**
 * Members as picker groups, one per role, so a long list reads as "who does
 * what" rather than one undifferentiated column of names. Members with a role
 * not listed above land in "Others". The email is the second line, which tells
 * apart two people with the same name.
 */
export function memberGroups(
  members: Member[],
  options: { exclude?: string; order?: string[] } = {},
): AssigneeGroup[] {
  const pool = members.filter((m) => m.id !== options.exclude);
  const groups = options.order
    ? options.order
        .map((role) => ROLE_GROUPS.find((g) => g.roles.includes(role)))
        .filter((g, i, all): g is (typeof ROLE_GROUPS)[number] => !!g && all.indexOf(g) === i)
    : ROLE_GROUPS;

  const claimed = new Set<string>();
  const out: AssigneeGroup[] = [];
  for (const g of groups) {
    const people = pool.filter((m) => g.roles.includes(m.role ?? ""));
    people.forEach((m) => claimed.add(m.id));
    if (people.length > 0) out.push({ label: g.label, options: people.map(toOption) });
  }
  const rest = pool.filter((m) => !claimed.has(m.id));
  if (rest.length > 0) out.push({ label: "Others", options: rest.map(toOption) });
  return out;
}

function toOption(m: Member) {
  const name = memberLabel(m);
  return { id: m.id, name, hint: name === m.email ? undefined : m.email };
}

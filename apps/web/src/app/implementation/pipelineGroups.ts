import type { Ask, Pipeline } from "./api";
import { isOverdue } from "./meta";

/** One company's slice of the board: its pipeline (if any) and its asks. */
export interface PipelineGroup {
  /** The pipeline id, "acct:<accountId>" for a company with no pipeline row
   *  yet, or "unlinked" for asks with no company. */
  key: string;
  pipeline: Pipeline | null;
  title: string;
  locations: string;
  managerName: string | null;
  archived: boolean;
  asks: Ask[];
  open: number;
  blocked: number;
  overdue: number;
}

export const UNLINKED_KEY = "unlinked";

const CLOSED = new Set(["verified", "wont_do"]);

/** Which group an ask belongs to. Mirrors the server: a pipeline is the
 *  company's, so an ask without a pipeline row still lands with its company. */
export function groupKeyOf(ask: Ask): string {
  if (ask.pipelineId) return ask.pipelineId;
  if (ask.accountId) return `acct:${ask.accountId}`;
  return UNLINKED_KEY;
}

/**
 * Splits asks into per-company groups, alphabetical, "Unlinked" last.
 *
 * Every pipeline gets a group even when empty, so a freshly opened pipeline
 * shows up straight away; pass includeEmpty=false while a filter is active so
 * the board does not fill with empty companies.
 */
export function groupAsks(
  asks: Ask[],
  pipelines: Pipeline[],
  includeEmpty: boolean,
): PipelineGroup[] {
  const groups = new Map<string, PipelineGroup>();
  const byAccount = new Map<string, Pipeline>();

  for (const p of pipelines) {
    byAccount.set(p.accountId, p);
    groups.set(p.id, newGroup(p.id, p, p.accountName));
  }

  for (const ask of asks) {
    let key = groupKeyOf(ask);
    // An ask read before its pipeline existed still finds it by company.
    if (!groups.has(key) && ask.accountId && byAccount.has(ask.accountId)) {
      key = byAccount.get(ask.accountId)!.id;
    }
    let g = groups.get(key);
    if (!g) {
      const title =
        key === UNLINKED_KEY
          ? "Unlinked"
          : ask.accountName || ask.dealTitle || ask.leadTitle || "Unnamed company";
      g = newGroup(key, null, title);
      groups.set(key, g);
    }
    g.asks.push(ask);
    if (!CLOSED.has(ask.status)) g.open++;
    if (ask.status === "blocked") g.blocked++;
    if (isOverdue(ask)) g.overdue++;
  }

  for (const g of groups.values()) {
    if (!g.locations) g.locations = distinctLocations(g.asks);
  }

  return [...groups.values()]
    .filter((g) => includeEmpty || g.asks.length > 0)
    .sort((a, b) => {
      if (a.key === UNLINKED_KEY) return 1;
      if (b.key === UNLINKED_KEY) return -1;
      return a.title.localeCompare(b.title);
    });
}

/** Case-insensitive match on company, location or manager. */
export function matchesSearch(g: PipelineGroup, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [g.title, g.locations, g.managerName ?? ""].some((v) =>
    v.toLowerCase().includes(needle),
  );
}

function newGroup(key: string, p: Pipeline | null, title: string): PipelineGroup {
  return {
    key,
    pipeline: p,
    title,
    locations: p?.locations ?? "",
    managerName: p?.managerName ?? null,
    archived: Boolean(p?.archivedAt),
    asks: [],
    open: 0,
    blocked: 0,
    overdue: 0,
  };
}

function distinctLocations(asks: Ask[]): string {
  const seen = new Set<string>();
  for (const a of asks) {
    for (const part of (a.locations ?? "").split(";")) {
      const t = part.trim();
      if (t) seen.add(t);
    }
  }
  return [...seen].join("; ");
}

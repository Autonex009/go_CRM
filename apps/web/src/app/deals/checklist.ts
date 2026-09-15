/**
 * A deal's remark, read and written as a checklist.
 *
 * There is no checklist table: items live in the deal's existing `remark`
 * column, one per line, in the markdown convention `- [ ] text` / `- [x] text`.
 * That keeps the storage a plain string, so every other surface that still
 * shows a remark (the accounts profile column, exports) renders something a
 * human can read rather than a blob of JSON.
 *
 * Tasks carry no assignee. Handing work to a person means giving it an owner, a
 * due date and somewhere to be reported — which is what an Action is — so the
 * checklist promotes an item into one rather than half-tracking it here. The
 * `@<uuid>` suffix an earlier revision wrote is still parsed off so those rows
 * read as clean text, but it is never written again.
 */

export interface ChecklistItem {
  /** Stable within one parse; the list's order is its identity in storage. */
  id: string;
  text: string;
  done: boolean;
}

const ITEM = /^\s*[-*]\s*\[([ xX])\]\s*(.*)$/;
const ASSIGNEE = /\s*@([0-9a-fA-F-]{36})\s*$/;

/**
 * Metadata the deal card already shows as its own badges. Older remarks are
 * prose that repeats it ("Abhinash Kumar Number of cameras- 15 Location- …"),
 * so it is stripped when prose is converted rather than carried into a task.
 */
const NOISE = [
  /\b(?:number\s+of\s+cameras?|no\.?\s+of\s+cameras?|cams?)\s*[:\-]?\s*(?:\d+|TBD|NA)?/gi,
  /\blocation\s*[:\-]?\s*[^,\n;]*/gi,
  /\bproducts?\s*[:\-]\s*[^,\n;]*/gi,
  /\bsite\s*[:\-]\s*[^,\n;]+/gi,
  // "Number of ," — the label survived an import that had no value to go with it.
  /\b(?:number|no\.?)\s+of\s*(?=[,;|]|$)/gi,
];

/** Leftover punctuation once the metadata between it has been removed. */
const DANGLING = /^[\s,;:.\-–|]+|[\s,;:.\-–|]+$/g;

/**
 * Text that is only a person's name — one to four capitalised words, no verb.
 * Legacy remarks often open with the lead's name, and a task that says nothing
 * but "Abhinash Kumar" is not a task: it is the card's own lead field repeated,
 * and ticking it would write that noise back to the deal.
 */
const NAME_ONLY = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]*){0,3}$/;

/** Strips the card's badge metadata out of free text. */
export function stripCardMetadata(text: string, ignore: readonly string[] = []): string {
  let out = text;
  for (const pattern of NOISE) out = out.replace(pattern, " ");

  // The lead and contact names are already their own row on the card.
  for (const name of ignore) {
    const trimmed = name.trim();
    if (trimmed.length < 3) continue;
    out = out.replace(new RegExp(escapeRegExp(trimmed), "gi"), " ");
  }

  return out.replace(/\s{2,}/g, " ").replace(DANGLING, "").trim();
}

function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseChecklist(
  remark: string | null | undefined,
  ignore: readonly string[] = [],
): ChecklistItem[] {
  const raw = (remark ?? "").trim();
  if (!raw) return [];

  const lines = raw.split("\n");
  const structured = lines.filter((l) => ITEM.test(l));

  if (structured.length > 0) {
    return structured.map((line, i) => {
      const [, mark, rest] = line.match(ITEM)!;
      return {
        id: `item-${i}`,
        text: rest.replace(ASSIGNEE, "").trim(),
        done: mark.toLowerCase() === "x",
      };
    });
  }

  const prose = stripCardMetadata(raw.replace(/\n+/g, " "), ignore);
  // Too short to be an instruction, or just somebody's name: not a task.
  if (prose.length < 4 || NAME_ONLY.test(prose)) return [];
  return [{ id: "item-0", text: prose, done: false }];
}

/** Writes items back to the string the deal's remark column stores. */
export function serializeChecklist(items: ChecklistItem[]): string {
  return items
    .filter((item) => item.text.trim())
    .map((item) => `- [${item.done ? "x" : " "}] ${item.text.trim()}`)
    .join("\n");
}

export function pendingItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => !i.done);
}

export function completedItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.done);
}

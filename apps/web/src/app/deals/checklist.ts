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
 * due date and somewhere to be reported — which is what an Action is — so that
 * work is created from the card's Actions toggle instead. The `@<uuid>` suffix
 * an earlier revision wrote is still parsed off so those rows read as clean
 * text, but it is never written again.
 *
 * Priority rides at the front of the text as `!high` / `!med`, chosen because
 * it survives being read as plain text somewhere else — a remark that says
 * "!high Call the customer" still makes sense to a human.
 */

/** Ordered most urgent first; that order is what sorts a card's task list. */
export const TASK_PRIORITIES = ["high", "medium", "normal"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ChecklistItem {
  /** Stable within one parse; the list's order is its identity in storage. */
  id: string;
  text: string;
  done: boolean;
  priority: TaskPriority;
}

const ITEM = /^\s*[-*]\s*\[([ xX])\]\s*(.*)$/;
const ASSIGNEE = /\s*@([0-9a-fA-F-]{36})\s*$/;
const PRIORITY = /^!(high|urgent|med|medium|low|normal)\b\s*/i;

/**
 * How each priority reads and paints. Kept beside the parser so the storage
 * token, the label and the colour can never drift apart.
 */
export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; ring: string; fill: string; text: string }
> = {
  high: {
    label: "High",
    dot: "bg-rose-500",
    ring: "border-rose-500",
    fill: "bg-rose-500",
    text: "text-rose-500",
  },
  medium: {
    label: "Medium",
    dot: "bg-amber-500",
    ring: "border-amber-500",
    fill: "bg-amber-500",
    text: "text-amber-600",
  },
  normal: {
    label: "Normal",
    dot: "bg-sky-500",
    ring: "border-sky-500",
    fill: "bg-sky-500",
    text: "text-sky-600",
  },
};

/** The word written back for each priority; "normal" writes no marker at all. */
const PRIORITY_TOKEN: Record<TaskPriority, string> = {
  high: "!high ",
  medium: "!med ",
  normal: "",
};

function readPriority(text: string): { priority: TaskPriority; rest: string } {
  const match = text.match(PRIORITY);
  if (!match) return { priority: "normal", rest: text };

  const word = match[1].toLowerCase();
  const priority: TaskPriority =
    word === "high" || word === "urgent" ? "high" : word.startsWith("med") ? "medium" : "normal";
  return { priority, rest: text.slice(match[0].length) };
}

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
      const { priority, rest: body } = readPriority(rest.replace(ASSIGNEE, "").trim());
      return {
        id: `item-${i}`,
        text: body.trim(),
        done: mark.toLowerCase() === "x",
        priority,
      };
    });
  }

  const prose = stripCardMetadata(raw.replace(/\n+/g, " "), ignore);
  // Too short to be an instruction, or just somebody's name: not a task.
  if (prose.length < 4 || NAME_ONLY.test(prose)) return [];
  return [{ id: "item-0", text: prose, done: false, priority: "normal" }];
}

/** Writes items back to the string the deal's remark column stores. */
export function serializeChecklist(items: ChecklistItem[]): string {
  return items
    .filter((item) => item.text.trim())
    .map(
      (item) =>
        `- [${item.done ? "x" : " "}] ${PRIORITY_TOKEN[item.priority]}${item.text.trim()}`,
    )
    .join("\n");
}

export function pendingItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => !i.done);
}

export function completedItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((i) => i.done);
}

/**
 * Most urgent first, with each priority band keeping the order it was written
 * in — a stable sort, so ticking one task never reshuffles the rest.
 */
export function byPriority(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort(
    (a, b) => TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority),
  );
}

/** Wire format for a mention: @[Display Name](user:<uuid>). */
const TOKEN = /@\[([^\]\n]{1,120})\]\(user:([0-9a-fA-F-]{36})\)/g;

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "mention"; name: string; userId: string };

export interface PickedMention {
  id: string;
  name: string;
}

/** Splits stored content into text and mention segments for rendering. */
export function segments(content: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of content.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: content.slice(last, at) });
    out.push({ kind: "mention", name: m[1], userId: m[2] });
    last = at + m[0].length;
  }
  if (last < content.length) out.push({ kind: "text", text: content.slice(last) });
  return out;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Turns the "@Name" the user sees back into tokens for the given people. */
export function encodeMentions(text: string, people: PickedMention[]): string {
  // Longest names first so "@Ann Lee" wins over "@Ann".
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  return sorted.reduce((acc, p) => {
    const token = `@[${p.name.replace(/[\]\n]/g, " ")}](user:${p.id})`;
    return acc.replace(
      new RegExp(`(?<![\\p{L}\\p{N}_])@${escapeRegExp(p.name)}(?![\\p{L}\\p{N}_])`, "gu"),
      () => token,
    );
  }, text);
}

/** The editable form of stored content, plus the mentions it carried. */
export function decodeMentions(content: string): { text: string; picked: PickedMention[] } {
  const picked = new Map<string, PickedMention>();
  const text = content.replace(TOKEN, (_, name: string, id: string) => {
    picked.set(id, { id, name });
    return `@${name}`;
  });
  return { text, picked: [...picked.values()] };
}

/** The "@query" being typed right before the caret, if any. */
export function activeMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,40})$/.exec(before);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}

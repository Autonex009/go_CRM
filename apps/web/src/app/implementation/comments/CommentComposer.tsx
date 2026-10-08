import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CornerDownRight, Send, X } from "lucide-react";

import { Avatar, Button } from "../../ui";
import type { Mentionable } from "../api";
import { activeMentionQuery, encodeMentions, type PickedMention } from "./mentions";

// Server cap is 5000 after mentions are encoded; leave room for the tokens.
const MAX_LEN = 4000;
const MAX_SUGGESTIONS = 6;

interface CommentComposerProps {
  people: Mentionable[];
  onSubmit: (content: string) => Promise<unknown>;
  /** Initial plain text and mentions, for editing or a restored draft. */
  initialText?: string;
  initialPicked?: PickedMention[];
  replyingTo?: string | null;
  onCancelReply?: () => void;
  onCancel?: () => void;
  onDraftChange?: (text: string) => void;
  submitLabel?: string;
  autoFocus?: boolean;
}

export function CommentComposer({
  people,
  onSubmit,
  initialText = "",
  initialPicked = [],
  replyingTo,
  onCancelReply,
  onCancel,
  onDraftChange,
  submitLabel = "Comment",
  autoFocus = false,
}: CommentComposerProps) {
  const [text, setText] = useState(initialText);
  const [picked, setPicked] = useState<PickedMention[]>(initialPicked);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const typed = activeMentionQuery(text, caret);
  const mention = typed && typed.start !== dismissedAt ? typed : null;
  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_SUGGESTIONS);
  }, [mention, people]);
  const open = suggestions.length > 0;

  useEffect(() => setHighlight(0), [mention?.query]);

  // Grow with the content up to a cap, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  useEffect(() => {
    if (replyingTo) ref.current?.focus();
  }, [replyingTo]);

  const update = (next: string, nextCaret: number) => {
    setText(next);
    setCaret(nextCaret);
    onDraftChange?.(next);
  };

  const choose = (p: Mentionable) => {
    if (!mention) return;
    const insert = `@${p.name} `;
    const next = text.slice(0, mention.start) + insert + text.slice(caret);
    const nextCaret = mention.start + insert.length;
    update(next, nextCaret);
    setPicked((prev) => (prev.some((m) => m.id === p.id) ? prev : [...prev, { id: p.id, name: p.name }]));
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Comment cannot be empty");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Picked people, plus anyone typed by name (e.g. in a restored draft).
      const known = new Map(picked.map((p) => [p.id, p]));
      for (const p of people) {
        if (!known.has(p.id) && trimmed.includes(`@${p.name}`)) known.set(p.id, { id: p.id, name: p.name });
      }
      const used = [...known.values()].filter((p) => trimmed.includes(`@${p.name}`));
      await onSubmit(encodeMentions(trimmed, used));
      update("", 0);
      setPicked([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post that comment");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && !e.nativeEvent.isComposing) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDismissedAt(mention?.start ?? null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
    // Escape cancels an edit or a reply; otherwise it closes the dialog.
    if (e.key === "Escape" && (onCancel || (replyingTo && onCancelReply))) {
      e.stopPropagation();
      (onCancel ?? onCancelReply)?.();
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      {replyingTo && (
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <CornerDownRight className="h-3 w-3" />
          Replying to <span className="font-semibold text-fg">{replyingTo}</span>
          <button
            type="button"
            onClick={onCancelReply}
            className="ml-auto rounded p-0.5 hover:bg-surface-muted hover:text-fg"
            aria-label="Cancel reply"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20">
        <textarea
          ref={ref}
          value={text}
          rows={2}
          maxLength={MAX_LEN}
          autoFocus={autoFocus}
          placeholder="Write a comment… use @ to mention someone"
          aria-label="Comment"
          aria-autocomplete="list"
          aria-expanded={open}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          className="block w-full resize-none bg-transparent px-3 pt-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-1.5">
          <span className="text-[10px] text-fg-subtle">⌘/Ctrl + Enter to send</span>
          <div className="flex gap-1.5">
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              disabled={busy || !text.trim()}
              onClick={() => void submit()}
            >
              <Send className="h-3.5 w-3.5" /> {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <ul
          role="listbox"
          aria-label="Mention someone"
          className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {suggestions.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                  i === highlight ? "bg-accent-soft text-accent-on" : "text-fg"
                }`}
              >
                <Avatar name={p.name} size="xs" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-[10px] capitalize text-fg-subtle">
                  {p.role.replace("_", " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-[11px] font-medium text-bad-fg">{error}</p>}
    </div>
  );
}

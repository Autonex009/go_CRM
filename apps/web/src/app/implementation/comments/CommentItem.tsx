import { useState } from "react";
import { Pencil, Reply, Trash2 } from "lucide-react";

import { relativeTime } from "../../activities/api";
import { Avatar } from "../../ui";
import type { AskComment, Mentionable } from "../api";
import { CommentComposer } from "./CommentComposer";
import { decodeMentions, segments } from "./mentions";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface CommentItemProps {
  comment: AskComment;
  viewerId?: string;
  viewerRole?: string;
  people: Mentionable[];
  highlighted?: boolean;
  isReply?: boolean;
  onReply?: (c: AskComment) => void;
  onEdit: (id: string, content: string) => Promise<unknown>;
  onDelete: (id: string) => void;
}

export function CommentItem({
  comment: c,
  viewerId,
  viewerRole,
  people,
  highlighted = false,
  isReply = false,
  onReply,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const pending = c.id.startsWith("pending-");
  const own = !!viewerId && c.authorId === viewerId;
  const canEdit = own && !pending && Date.now() - Date.parse(c.createdAt) < EDIT_WINDOW_MS;
  const canDelete = !pending && (own || viewerRole === "owner" || viewerRole === "admin");

  if (c.isDeleted) {
    return (
      <div id={`comment-${c.id}`} className="py-1.5 text-xs italic text-fg-subtle">
        This comment was deleted.
      </div>
    );
  }

  const draft = editing ? decodeMentions(c.content) : null;

  return (
    <article
      id={`comment-${c.id}`}
      className={`group flex gap-2.5 rounded-lg px-2 py-2 transition-colors ${
        highlighted ? "animate-pulse bg-accent-soft/60" : "hover:bg-surface-muted/50"
      } ${pending ? "opacity-60" : ""}`}
    >
      <Avatar name={c.authorName || "Former member"} size={isReply ? "xs" : "sm"} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
          <span className="font-semibold text-fg">{c.authorName || "Former member"}</span>
          {c.authorRole && (
            <span className="rounded bg-surface-muted px-1 py-px text-[10px] capitalize text-fg-subtle">
              {c.authorRole.replace("_", " ")}
            </span>
          )}
          <time className="text-[11px] text-fg-subtle" dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
            {pending ? "sending…" : relativeTime(c.createdAt)}
          </time>
          {c.editedAt && <span className="text-[10px] text-fg-subtle">(edited)</span>}
        </header>

        {editing && draft ? (
          <div className="mt-1">
            <CommentComposer
              people={people}
              initialText={draft.text}
              initialPicked={draft.picked}
              submitLabel="Save"
              autoFocus
              onCancel={() => setEditing(false)}
              onSubmit={async (content) => {
                await onEdit(c.id, content);
                setEditing(false);
              }}
            />
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-snug text-fg">
            {segments(c.content).map((s, i) =>
              s.kind === "text" ? (
                <span key={i}>{s.text}</span>
              ) : (
                <span
                  key={i}
                  className={`rounded px-0.5 font-medium ${
                    s.userId === viewerId ? "bg-warn-soft text-warn-fg" : "bg-accent-soft text-accent-on"
                  }`}
                >
                  @{s.name}
                </span>
              ),
            )}
          </p>
        )}

        {!editing && !pending && (
          <div className="mt-1 flex gap-3 text-[11px] font-medium text-fg-subtle opacity-70 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {onReply && (
              <button type="button" onClick={() => onReply(c)} className="inline-flex items-center gap-1 hover:text-fg">
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 hover:text-fg">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this comment?")) onDelete(c.id);
                }}
                className="inline-flex items-center gap-1 hover:text-bad-fg"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

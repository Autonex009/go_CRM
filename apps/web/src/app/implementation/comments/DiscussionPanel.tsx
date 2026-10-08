import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";

import { useAuthStore } from "../../auth/store";
import { ApiError } from "../../lib/api";
import { Alert, Button, Skeleton } from "../../ui";
import { implementationApi, type AskComment } from "../api";
import { CommentComposer } from "./CommentComposer";
import { CommentItem } from "./CommentItem";
import { useAskComments } from "./useAskComments";

const draftKey = (askId: string) => `ask_comment_draft_${askId}`;

function readDraft(askId: string): string {
  try {
    return window.localStorage.getItem(draftKey(askId)) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(askId: string, text: string) {
  try {
    if (text) window.localStorage.setItem(draftKey(askId), text);
    else window.localStorage.removeItem(draftKey(askId));
  } catch {
    // Storage unavailable: the draft just isn't kept.
  }
}

interface Thread {
  root: AskComment;
  replies: AskComment[];
}

function threads(comments: AskComment[]): Thread[] {
  const byId = new Map<string, Thread>();
  const out: Thread[] = [];
  for (const c of comments) {
    if (!c.parentCommentId) {
      const t = { root: c, replies: [] };
      byId.set(c.id, t);
      out.push(t);
    }
  }
  for (const c of comments) {
    if (c.parentCommentId) byId.get(c.parentCommentId)?.replies.push(c);
  }
  return out;
}

export function DiscussionPanel({
  askId,
  active = true,
  focusCommentId,
}: {
  askId: string;
  active?: boolean;
  focusCommentId?: string | null;
}) {
  const user = useAuthStore((s) => s.user);
  const { query, comments, total, add, edit, remove } = useAskComments(askId, active);
  const [replyTo, setReplyTo] = useState<AskComment | null>(null);
  const [initialDraft] = useState(() => readDraft(askId));
  const [highlight, setHighlight] = useState<string | null>(focusCommentId ?? null);

  const people = useQuery({
    queryKey: ["askMentionable", askId],
    queryFn: () => implementationApi.mentionable(askId),
    staleTime: 5 * 60_000,
  });
  const others = useMemo(
    () => (people.data ?? []).filter((p) => p.id !== user?.id),
    [people.data, user?.id],
  );

  const list = useMemo(() => threads(comments), [comments]);

  const { isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (!highlight || isPending) return;
    const el = document.getElementById(`comment-${highlight}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = window.setTimeout(() => setHighlight(null), 2500);
      return () => window.clearTimeout(t);
    }
    // Deep-linked comment not loaded yet: page forward until it is.
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [highlight, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, comments.length]);

  const post = async (content: string) => {
    await add.mutateAsync({ content, parentCommentId: replyTo?.id ?? null });
    setReplyTo(null);
    writeDraft(askId, "");
  };

  const item = (c: AskComment, isReply: boolean) => (
    <CommentItem
      key={c.id}
      comment={c}
      isReply={isReply}
      viewerId={user?.id}
      viewerRole={user?.role}
      people={others}
      highlighted={highlight === c.id}
      onReply={setReplyTo}
      onEdit={(id, content) => edit.mutateAsync({ id, content })}
      onDelete={(id) => remove.mutate(id)}
    />
  );

  const mutationError = remove.error ?? edit.error;

  return (
    <section aria-label="Discussion" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 pb-2">
        <MessageSquare className="h-4 w-4 text-fg-subtle" />
        <h3 className="text-sm font-semibold text-fg">Discussion</h3>
        <span className="rounded-full bg-surface-muted px-1.5 text-[11px] tabular-nums text-fg-muted">
          {total}
        </span>
      </header>

      <div className="min-h-[120px] flex-1 overflow-y-auto overscroll-contain pr-1">
        {query.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
          </div>
        ) : query.isError ? (
          <Alert>
            {query.error instanceof ApiError ? query.error.message : "Could not load the discussion"}
          </Alert>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-xs text-fg-subtle">
            No comments yet. Start the conversation — use @ to loop someone in.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {list.map((t) => (
              <li key={t.root.id}>
                {item(t.root, false)}
                {t.replies.length > 0 && (
                  <ol className="ml-5 border-l border-line pl-2">
                    {t.replies.map((r) => (
                      <li key={r.id}>{item(r, true)}</li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
        {query.hasNextPage && (
          <div className="py-2 text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load more
            </Button>
          </div>
        )}
      </div>

      {mutationError && (
        <Alert>{mutationError instanceof Error ? mutationError.message : "Something went wrong"}</Alert>
      )}

      <div className="border-t border-line pt-2">
        <CommentComposer
          people={others}
          initialText={initialDraft}
          replyingTo={replyTo ? replyTo.authorName || "comment" : null}
          onCancelReply={() => setReplyTo(null)}
          onDraftChange={(t) => writeDraft(askId, t)}
          onSubmit={post}
        />
      </div>
    </section>
  );
}

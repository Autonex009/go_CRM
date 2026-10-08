import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { useAuthStore } from "../../auth/store";
import { implementationApi, type AskComment, type CommentPage } from "../api";

const POLL_MS = 15_000;

export const commentsKey = (askId: string) => ["askComments", askId] as const;

type Pages = InfiniteData<CommentPage, string | undefined>;

/** An ask's discussion, polled while open, with optimistic posting. */
export function useAskComments(askId: string, active: boolean) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const key = commentsKey(askId);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => implementationApi.comments(askId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: active ? POLL_MS : false,
    refetchOnWindowFocus: active,
  });

  const refreshBoard = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    void queryClient.invalidateQueries({ queryKey: ["dealAsks"] });
    void queryClient.invalidateQueries({ queryKey: ["subtasks"] });
  };

  const add = useMutation({
    mutationFn: (v: { content: string; parentCommentId?: string | null }) =>
      implementationApi.addComment(askId, v.content, v.parentCommentId),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Pages>(key);
      const now = new Date().toISOString();
      // Replies to replies join the root's thread, as the server does.
      const all = previous?.pages.flatMap((p) => p.comments) ?? [];
      const parent = all.find((c) => c.id === v.parentCommentId);
      const optimistic: AskComment = {
        id: `pending-${now}`,
        askId,
        parentCommentId: parent?.parentCommentId ?? v.parentCommentId ?? null,
        authorId: user?.id ?? null,
        authorName: user?.name || user?.email || "You",
        authorRole: user?.role ?? "",
        authorAvatarUrl: null,
        content: v.content,
        mentions: [],
        editedAt: null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      if (previous) {
        const last = previous.pages.length - 1;
        // With unloaded pages after this one, appending would misplace it.
        const append = !previous.pages[last]?.nextCursor;
        const pages = previous.pages.map((p, i) => ({
          ...p,
          comments: append && i === last ? [...p.comments, optimistic] : p.comments,
          totalCount: i === 0 ? p.totalCount + 1 : p.totalCount,
        }));
        queryClient.setQueryData<Pages>(key, { ...previous, pages });
      }
      return { previous };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      refreshBoard();
    },
  });

  const edit = useMutation({
    mutationFn: (v: { id: string; content: string }) =>
      implementationApi.editComment(askId, v.id, v.content),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => implementationApi.deleteComment(askId, id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["askEvents", askId] });
      refreshBoard();
    },
  });

  const comments = query.data?.pages.flatMap((p) => p.comments) ?? [];
  const total = query.data?.pages[0]?.totalCount ?? 0;

  return { query, comments, total, add, edit, remove };
}

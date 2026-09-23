import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { ApiError } from "../lib/api";
import { implementationApi, type Ask } from "./api";

/**
 * Deletes an ask after a confirm, from wherever it is shown.
 *
 * One hook so the board, the deal card and the deal's work view ask the same
 * question and refresh the same caches — including the dashboard's activity
 * feed, since an ask's history goes with it.
 *
 * onDeleted gets the id that went, so a caller closes its dialog only when that
 * is the ask it has open — the same hook deletes from every card on the board.
 *
 * The returned function is stable across renders: the deal board passes it
 * into memoised cards, and a fresh one each render would re-render them all.
 */
export function useDeleteAsk(onDeleted?: (id: string) => void): (ask: Pick<Ask, "id" | "title">) => void {
  const queryClient = useQueryClient();

  const onDeletedRef = useRef(onDeleted);
  useEffect(() => {
    onDeletedRef.current = onDeleted;
  });

  const { mutate } = useMutation({
    mutationFn: (id: string) => implementationApi.remove(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["implementation"] });
      void queryClient.invalidateQueries({ queryKey: ["dealAsks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboardActivity"] });
      onDeletedRef.current?.(id);
    },
    onError: (err) => {
      window.alert(err instanceof ApiError ? err.message : "Could not delete that ask");
    },
  });

  return useCallback(
    (ask: Pick<Ask, "id" | "title">) => {
      if (!window.confirm(`Delete "${ask.title}"? Its history and files go with it.`)) return;
      mutate(ask.id);
    },
    [mutate],
  );
}

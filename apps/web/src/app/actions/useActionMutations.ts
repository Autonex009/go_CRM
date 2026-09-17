import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { ApiError } from "../lib/api";
import { actionsApi, type ActionUpdateInput } from "./api";

/**
 * The save/delete/complete trio every Actions surface needs, plus the one error
 * string they all report through. Both the dashboard and the company profile
 * tab mount this, so a fix to the invalidation or the error wording lands in
 * both at once.
 */
export function useActionMutations() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Every actions query — filtered lists, the metrics roll-up, and the per-client
  // tab — hangs off the "actions" key, so one invalidation refreshes them all.
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["actions"] });
  }, [queryClient]);

  const settle = useCallback(
    (fallback: string) => ({
      onSuccess: () => {
        setError(null);
        invalidate();
      },
      onError: (err: unknown) =>
        setError(err instanceof ApiError ? err.message : fallback),
    }),
    [invalidate],
  );

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ActionUpdateInput }) => {
      if (id) return actionsApi.update(id, input);
      // The gateway rejects unknown JSON fields, and a new action always starts
      // "open" server-side — status is only ever sent on an update.
      const { status: _status, ...createInput } = input;
      return actionsApi.create(createInput);
    },
    ...settle("Could not save that action"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => actionsApi.remove(id),
    ...settle("Could not delete that action"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => actionsApi.complete(id),
    ...settle("Could not complete that action"),
  });

  return { save, remove, complete, error, setError };
}

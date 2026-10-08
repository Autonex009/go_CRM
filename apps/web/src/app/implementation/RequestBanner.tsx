import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Hourglass, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";

import { useAuthStore } from "../auth/store";
import { relativeTime } from "../activities/api";
import { Button } from "../ui";
import { implementationApi, type Ask } from "./api";

/** Where a manager request stands, and the resubmit action once sent back. */
export function RequestBanner({ ask }: { ask: Ask }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(ask.reviewStatus);

  const resubmit = useMutation({
    mutationFn: () => implementationApi.resubmit(ask.id),
    onSuccess: (a) => {
      setStatus(a.reviewStatus);
      void queryClient.invalidateQueries({ queryKey: ["implementation"] });
      void queryClient.invalidateQueries({ queryKey: ["askRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["askEvents", ask.id] });
    },
  });

  if (!status) return null;
  const canResubmit =
    status === "rejected" && (user?.role === "manager" || user?.id === ask.createdBy);

  if (status === "approved") {
    return (
      <p className="flex items-center gap-2 rounded-md bg-ok-soft px-md py-sm text-xs text-ok-fg">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Request approved{ask.dealTitle ? ` and linked to ${ask.dealTitle}` : ""}
        {ask.reviewedAt ? ` · ${relativeTime(ask.reviewedAt)}` : ""}
      </p>
    );
  }

  if (status === "pending") {
    return (
      <p className="flex items-center gap-2 rounded-md bg-warn-soft px-md py-sm text-xs text-warn-fg">
        <Hourglass className="h-3.5 w-3.5 shrink-0" />
        Pending review by sales / admin — they'll link it to a deal.
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-md bg-bad-soft px-md py-sm text-xs text-bad-fg">
      <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Sent back for changes</p>
        {ask.reviewNote && <p className="mt-0.5 whitespace-pre-wrap break-words">{ask.reviewNote}</p>}
        {resubmit.error && (
          <p className="mt-1 font-medium">
            {resubmit.error instanceof Error ? resubmit.error.message : "Could not resubmit"}
          </p>
        )}
      </div>
      {canResubmit && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={resubmit.isPending}
          onClick={() => resubmit.mutate()}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Resubmit
        </Button>
      )}
    </div>
  );
}

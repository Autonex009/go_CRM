import { useQuery } from "@tanstack/react-query";

import { relativeTime } from "../activities/api";
import { Skeleton } from "../ui";
import { implementationApi } from "./api";
import { describeEvent } from "./meta";

/** Who changed what, and when. Newest first. */
export function AskHistory({ askId }: { askId: string }) {
  const query = useQuery({
    queryKey: ["askEvents", askId],
    queryFn: () => implementationApi.events(askId),
  });

  if (query.isPending) return <Skeleton className="h-16 w-full" />;

  const events = query.data ?? [];
  if (events.length === 0) return null;

  return (
    <details className="rounded-md border border-line bg-surface-muted/40">
      <summary className="cursor-pointer px-md py-sm text-xs font-medium text-fg-muted">
        History · {events.length}
      </summary>
      <ul className="flex flex-col gap-1 px-md pb-sm">
        {events.map((e) => (
          <li key={e.id} className="text-xs leading-snug text-fg-muted">
            <span className="font-medium text-fg">
              {e.actorName || "Someone"}
            </span>{" "}
            {describeEvent(e)}
            <span className="ml-1 text-fg-subtle">
              · {relativeTime(e.occurredAt)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

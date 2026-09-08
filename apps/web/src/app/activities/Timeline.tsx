import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { ApiError } from "../lib/api";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  SelectField,
  Skeleton,
} from "../ui";
import {
  ACTIVITY_KINDS,
  activitiesApi,
  activityKey,
  authorLabel,
  KIND_META,
  relativeTime,
  type Activity,
  type ActivityScope,
} from "./api";

interface TimelineProps {
  /** Which record's history to show. */
  scope: ActivityScope;
  title?: string;
  /** Hide the composer where logging doesn't apply (e.g. a read-only view). */
  canLog?: boolean;
  /**
   * Show a header toggle that folds the composer and the entries away.
   *
   * Opt-in rather than always on: on a record page the timeline is the point of
   * the screen, but inside a form it sits between the fields and the Save
   * button, and a long history pushes Save off the bottom.
   */
  collapsible?: boolean;
  /** Whether a collapsible timeline starts folded, before the viewer chooses. */
  defaultCollapsed?: boolean;
}

/**
 * Collapsed state is remembered per scope kind ("deal", "lead", …) rather than
 * per record: someone who folds the history away on one deal means it for deals,
 * not for that one deal, and keying by id would grow an entry per record ever
 * opened.
 */
function collapseKey(scope: ActivityScope): string {
  const kind =
    Object.keys(scope).find((k) => scope[k as keyof ActivityScope]) ?? "all";
  return `gocrm.timeline.${kind}.collapsed`;
}

function readCollapsed(key: string, fallback: boolean): boolean {
  // Storage throws outright in some privacy modes, and does not exist at all
  // during SSR.
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "1";
  } catch {
    return fallback;
  }
}

/**
 * The activity timeline: system events and human notes interleaved, newest
 * first.
 *
 * One component for every record type — the scope prop decides what it reads,
 * and the server already denormalizes the labels each row needs, so there are no
 * follow-up lookups per entry.
 */
export function Timeline({
  scope,
  title = "Activity",
  canLog = true,
  collapsible = false,
  defaultCollapsed = false,
}: TimelineProps) {
  const queryClient = useQueryClient();
  const key = activityKey(scope);

  const storageKey = collapseKey(scope);
  const [collapsed, setCollapsed] = useState(() =>
    collapsible ? readCollapsed(storageKey, defaultCollapsed) : false,
  );

  const toggle = useCallback(() => {
    setCollapsed((was) => {
      const next = !was;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // A preference that cannot be remembered still works for this visit.
      }
      return next;
    });
  }, [storageKey]);

  const query = useQuery({
    queryKey: key,
    queryFn: () => activitiesApi.list(scope),
    // Timelines are read far more than they change.
    staleTime: 30_000,
    // Folded away means not fetched: opening a deal should not pay for a
    // history nobody asked to see. Expanding loads it.
    enabled: !collapsed,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: key });
    // Staleness ("last activity", "days idle") is derived from this table.
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, key]);

  const activities = query.data ?? [];

  const subtitle = collapsed
    ? "Hidden — click to show"
    : query.isPending
      ? undefined
      : activities.length === 0
        ? "Nothing logged yet"
        : `${activities.length} entr${activities.length === 1 ? "y" : "ies"}`;

  return (
    <Card padded={false}>
      <div className="px-lg py-md">
        <CardHeader
          title={title}
          subtitle={subtitle}
          action={
            collapsible ? (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-controls={`timeline-${storageKey}`}
                className="-m-xs flex items-center gap-xs rounded-md p-xs text-xs font-medium text-fg-muted transition-colors duration-100 hover:bg-surface-hover hover:text-fg"
              >
                {collapsed ? "Show" : "Hide"}
                <Icon
                  name="chevronLeft"
                  size={14}
                  className={`transition-transform duration-150 ${
                    collapsed ? "-rotate-90" : "rotate-90"
                  }`}
                />
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Hidden rather than unmounted: the query is already disabled while
          collapsed, so nothing is fetched, and keeping the composer mounted
          means a half-typed note survives folding the panel away. */}
      <div id={`timeline-${storageKey}`} hidden={collapsed}>
        {canLog && <Composer scope={scope} onLogged={invalidate} />}

        {query.isError && (
          <div className="px-lg pb-md">
            <Alert>
              {query.error instanceof ApiError
                ? query.error.message
                : "Could not load the timeline"}
            </Alert>
          </div>
        )}

        {query.isPending ? (
          <div className="flex flex-col gap-sm px-lg pb-lg">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[46px] w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="border-t border-line px-lg py-lg text-sm text-fg-muted">
            Calls, notes and system events will appear here.
          </p>
        ) : (
          <ol className="border-t border-line">
            {activities.map((activity) => (
              <Entry
                key={activity.id}
                activity={activity}
                onChanged={invalidate}
              />
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function Entry({
  activity,
  onChanged,
}: {
  activity: Activity;
  onChanged: () => void;
}) {
  const meta = KIND_META[activity.kind] ?? KIND_META.note;
  const isSystem = activity.kind === "system";

  const remove = useMutation({
    mutationFn: () => activitiesApi.remove(activity.id),
    onSuccess: onChanged,
  });

  return (
    <li className="flex gap-md border-b border-line px-lg py-md last:border-0">
      {/* System events read as a quieter track than things a person did. */}
      <span
        className={`mt-[2px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${
          isSystem
            ? "bg-surface-muted text-fg-subtle"
            : "bg-accent-soft text-accent-on"
        }`}
      >
        <Icon name={meta.icon} size={13} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-sm">
          <p
            className={`text-sm ${isSystem ? "text-fg-muted" : "font-medium text-fg"}`}
          >
            {activity.subject || meta.label}
          </p>
          {!isSystem && <Badge tone={meta.tone}>{meta.label}</Badge>}
          {activity.durationMinutes ? (
            <span className="text-xs text-fg-subtle">
              {activity.durationMinutes} min
            </span>
          ) : null}
        </div>

        {activity.body && (
          <p className="mt-xs whitespace-pre-wrap text-sm text-fg-muted">
            {activity.body}
          </p>
        )}

        <p className="mt-xs text-xs text-fg-subtle">
          {authorLabel(activity)} · {relativeTime(activity.occurredAt)}
        </p>
      </div>

      {/* System events are the record of what happened; only human entries can go. */}
      {!isSystem && (
        <Button
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm("Delete this entry?")) remove.mutate();
          }}
        >
          <span className="text-fg-subtle">×</span>
        </Button>
      )}
    </li>
  );
}

function Composer({
  scope,
  onLogged,
}: {
  scope: ActivityScope;
  onLogged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof ACTIVITY_KINDS)[number]>("call");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const log = useMutation({
    mutationFn: () =>
      activitiesApi.create({
        ...scope,
        kind,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      }),
    onSuccess: () => {
      setSubject("");
      setBody("");
      setError(null);
      setOpen(false);
      onLogged();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not log that activity",
      ),
  });

  if (!open) {
    return (
      <div className="border-t border-line px-lg py-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-xs rounded-md px-sm py-xs text-xs font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <Icon name="plus" size={13} />
          Log a call or note
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        log.mutate();
      }}
      className="flex flex-col gap-sm border-t border-line bg-surface-muted/40 px-lg py-md"
    >
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-sm sm:grid-cols-[140px_1fr]">
        <SelectField
          label="Kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          {ACTIVITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_META[k].label}
            </option>
          ))}
        </SelectField>

        <label className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">Summary</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Demo call completed with Rohan"
            className="h-[36px] w-full rounded-md border border-line bg-surface px-md text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </label>
      </div>

      <label className="flex flex-col gap-xs">
        <span className="text-xs font-medium text-fg-muted">Notes</span>
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Key points, interest level, next steps…"
          className="w-full resize-y rounded-md border border-line bg-surface px-md py-sm text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </label>

      <div className="flex justify-end gap-sm">
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={log.isPending || (!subject.trim() && !body.trim())}
        >
          {log.isPending ? "Logging…" : "Log activity"}
        </Button>
      </div>
    </form>
  );
}

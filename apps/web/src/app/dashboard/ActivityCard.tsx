import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";

import { KIND_META, relativeTime, type ActivityKind } from "../activities/api";
import { describeEvent } from "../implementation/meta";
import {
  dashboardApi,
  type ActivityItem,
  type ActivitySource,
} from "../lib/dashboard";
import { Button, Card, CardHeader, EmptyState, Icon, Skeleton } from "../ui";

const PAGE_SIZE = 8;

/** The filter chips, in the order they read. */
const FILTERS: { source: ActivitySource; label: string }[] = [
  { source: "all", label: "All" },
  { source: "lead", label: "Leads" },
  { source: "deal", label: "Deals" },
  { source: "account", label: "Accounts" },
  { source: "quote", label: "Quotes" },
  { source: "implementation", label: "Implementation" },
];

const SUBTITLES: Record<ActivitySource, string> = {
  all: "The last things that happened here",
  lead: "Calls, notes and changes on leads",
  deal: "Calls, notes and stage changes on deals",
  account: "What happened on your accounts",
  quote: "Quotes drafted, sent and signed",
  implementation: "Every change made to an implementation ask",
};

/**
 * The dashboard's activity feed.
 *
 * Two sources, because they answer different questions. The timeline is the
 * headlines, one row per thing that happened, and can be narrowed to one kind
 * of record. "Implementation" is every change made to an engineering ask, down
 * to which field moved and what it moved between, which is too much detail to
 * mix into the first.
 */
export function ActivityCard({ className = "" }: { className?: string }) {
  const [source, setSource] = useState<ActivitySource>("all");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["dashboardActivity", source, page],
    queryFn: () => dashboardApi.activity(source, PAGE_SIZE, page * PAGE_SIZE),
    // Keeps the previous page on screen while the next one loads, so paging
    // does not collapse the card to a skeleton on every click.
    placeholderData: keepPreviousData,
  });

  const show = (next: ActivitySource) => {
    setSource(next);
    setPage(0);
  };

  const data = query.data;
  const items = data?.items ?? [];
  const implementation = source === "implementation";
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const to = page * PAGE_SIZE + items.length;
  const from = items.length > 0 ? page * PAGE_SIZE + 1 : 0;

  // A page past the end — rows deleted since it was opened — steps back to the
  // last one rather than showing an empty card with "9 of 8" under it.
  useEffect(() => {
    if (data && page > 0 && page >= pageCount) setPage(pageCount - 1);
  }, [data, page, pageCount]);

  return (
    <Card className={className} padded={false}>
      <CardHeader
        className="p-lg pb-sm"
        title="Recent activity"
        subtitle={SUBTITLES[source]}
      />

      <div
        role="group"
        aria-label="Filter activity"
        className="flex gap-1 overflow-x-auto px-lg pb-md [scrollbar-width:none]"
      >
        {FILTERS.map((f) => (
          <FilterChip
            key={f.source}
            active={source === f.source}
            onClick={() => show(f.source)}
          >
            {f.source === "implementation" && <Wrench className="h-3 w-3" />}
            {f.label}
          </FilterChip>
        ))}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-sm px-lg pb-lg">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[44px] w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-lg pb-lg">
          <EmptyState
            size="sm"
            icon={implementation ? "check" : "leads"}
            title={implementation ? "No ask activity yet" : "Nothing logged yet"}
            description={
              implementation
                ? "Raising, moving or editing an ask will show up here."
                : source === "all"
                  ? "Calls, notes and stage changes will appear here as they happen."
                  : "Nothing has been logged against these yet."
            }
          />
        </div>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={`${item.at}-${i}`}>
              <Row item={item} implementation={implementation} />
            </li>
          ))}
        </ul>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-x-md gap-y-xs border-t border-line px-lg py-sm">
          <span className="text-xs tabular-nums text-fg-subtle">
            {from}–{to} of {data.total}
          </span>
          <div className="flex items-center gap-xs">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <PageJump
              page={page}
              pageCount={pageCount}
              disabled={query.isFetching}
              onJump={setPage}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!data.hasMore || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * "Page [3] of 12". The box takes a number and jumps on Enter or blur; anything
 * out of range is pulled back to the nearest page, and anything that is not a
 * number puts the current page back.
 */
function PageJump({
  page,
  pageCount,
  disabled,
  onJump,
}: {
  page: number;
  pageCount: number;
  disabled: boolean;
  onJump: (page: number) => void;
}) {
  const [draft, setDraft] = useState(String(page + 1));

  // Follows the arrows and filter changes while the box is not being typed in.
  useEffect(() => setDraft(String(page + 1)), [page]);

  const commit = () => {
    const n = Number.parseInt(draft, 10);
    if (Number.isNaN(n)) {
      setDraft(String(page + 1));
      return;
    }
    const target = Math.min(Math.max(n, 1), pageCount) - 1;
    setDraft(String(target + 1));
    if (target !== page) onJump(target);
  };

  return (
    <label className="flex items-center gap-1 text-xs text-fg-subtle">
      <span>Page</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onFocus={(e) => e.target.select()}
        aria-label={`Page number, 1 to ${pageCount}`}
        className="h-7 w-10 rounded-md border border-line bg-surface px-1 text-center text-xs tabular-nums text-fg transition-colors focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-60"
      />
      <span className="tabular-nums">of {pageCount}</span>
    </label>
  );
}

function Row({
  item,
  implementation,
}: {
  item: ActivityItem;
  implementation: boolean;
}) {
  const meta = KIND_META[item.kind as ActivityKind] ?? KIND_META.system;

  const body = implementation
    ? describeEvent({
        kind: item.kind,
        field: item.field ?? "",
        fromValue: item.fromValue ?? "",
        toValue: item.toValue ?? "",
        note: item.body ?? "",
      })
    : item.body;

  const inner = (
    <>
      <span
        className={`mt-[2px] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md ${
          implementation
            ? "bg-violet-500/10 text-violet-600 dark:text-violet-300"
            : "bg-surface-muted text-fg-muted"
        }`}
      >
        {implementation ? <Wrench className="h-3 w-3" /> : <Icon name={meta.icon} size={13} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="truncate text-sm font-medium text-fg">{item.subject}</span>
          {implementation && item.context ? (
            <span className="truncate text-[11px] text-fg-subtle">{item.context}</span>
          ) : (
            item.entity && (
              <span className="rounded bg-surface-muted px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                {item.entity}
              </span>
            )
          )}
        </span>

        {body && (
          <span className="mt-px block truncate text-xs text-fg-muted">
            {implementation && item.actor ? `${item.actor} ${body}` : body}
          </span>
        )}

        {!implementation && item.actor && (
          <span className="mt-px block truncate text-[11px] text-fg-subtle">
            by {item.actor}
          </span>
        )}
      </span>

      <span
        className="shrink-0 whitespace-nowrap text-xs text-fg-subtle"
        title={new Date(item.at).toLocaleString()}
      >
        {relativeTime(item.at)}
      </span>
    </>
  );

  const shell = "flex items-start gap-md border-t border-line px-lg py-sm transition-colors";

  return item.actionUrl ? (
    <Link to={item.actionUrl} className={`${shell} hover:bg-surface-hover`}>
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-sm py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
        active
          ? "border-accent/40 bg-accent-soft text-accent-on"
          : "border-line bg-surface text-fg-muted hover:border-accent/30 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

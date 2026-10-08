import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Hourglass, Inbox, ShieldCheck, Undo2 } from "lucide-react";

import { relativeTime } from "../activities/api";
import { implementationApi, type Ask, type ReviewStatus } from "../implementation/api";
import { PRIORITY_META } from "../implementation/meta";
import { ReviewDialog } from "../implementation/RequestReview";
import { useRequests } from "../implementation/useRequestCounts";
import { ApiError } from "../lib/api";
import { Alert, Avatar, Button, EmptyState, PageHeader, Skeleton } from "../ui";

const TABS: { key: ReviewStatus; label: string; icon: React.ElementType; empty: string }[] = [
  { key: "pending", label: "Pending", icon: Hourglass, empty: "No requests waiting. New manager requests show up here." },
  { key: "rejected", label: "Sent back", icon: Undo2, empty: "Nothing sent back to managers." },
  { key: "approved", label: "Approved", icon: ShieldCheck, empty: "No approved requests yet." },
];

/** Every ask a manager requested, for GTM to edit, approve or send back. */
export default function AskRequests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get("request");
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [open, setOpen] = useState<Ask | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const pending = useRequests("pending");
  const rejected = useRequests("rejected");
  const approved = useRequests("approved");
  const byTab = { pending, rejected, approved };
  const current = byTab[tab];

  // ?request=<id> from a notification opens that request.
  useEffect(() => {
    if (!linked) return;
    implementationApi.get(linked).then(
      (a) => {
        if (a.reviewStatus) setTab(a.reviewStatus);
        setOpen(a);
      },
      () => setLinkError("That request could not be opened — it may have been deleted."),
    );
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("request");
        return next;
      },
      { replace: true },
    );
  }, [linked, setSearchParams]);

  const meta = TABS.find((t) => t.key === tab)!;
  const items = current.data ?? [];

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Ask requests"
        subtitle="Implementation asks raised by engineering managers. Edit them, approve with a deal, or send them back."
      />

      <div role="tablist" className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const count = byTab[t.key].data?.length;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {count !== undefined && (
                <span
                  className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                    t.key === "pending" && count > 0
                      ? "bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-400"
                      : "bg-surface-muted text-fg-subtle"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {linkError && <Alert>{linkError}</Alert>}

      {current.isError && (
        <Alert>{current.error instanceof ApiError ? current.error.message : "Could not load requests"}</Alert>
      )}

      {current.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="check" title={`${meta.label}: nothing here`} description={meta.empty} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-md py-3">
              <Avatar name={a.createdByName || "Manager"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{a.title}</p>
                <p className="truncate text-xs text-fg-muted">
                  {a.createdByName || "A manager"}
                  {a.accountName ? ` · ${a.accountName}` : " · no company yet"}
                  {a.dealTitle ? ` · deal: ${a.dealTitle}` : ""}
                  {a.submittedAt ? ` · requested ${relativeTime(a.submittedAt)}` : ""}
                </p>
                {tab === "rejected" && a.reviewNote && (
                  <p className="mt-0.5 truncate text-xs text-bad-fg" title={a.reviewNote}>
                    Note: {a.reviewNote}
                  </p>
                )}
              </div>
              {PRIORITY_META[a.priority] && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[a.priority].chip}`}>
                  {PRIORITY_META[a.priority].label}
                </span>
              )}
              <Button type="button" size="sm" variant={tab === "pending" ? "primary" : "secondary"} onClick={() => setOpen(a)}>
                {tab === "pending" ? "Review" : "Open"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {tab === "rejected" && items.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Inbox className="h-3.5 w-3.5" /> These come back to Pending when the manager resubmits.
        </p>
      )}

      {open && (
        <ReviewDialog key={open.id} ask={open} onClose={() => setOpen(null)} onChanged={setOpen} />
      )}
    </section>
  );
}

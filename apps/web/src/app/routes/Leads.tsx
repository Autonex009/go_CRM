import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConvertDialog } from "../leads/ConvertDialog";
import { LeadDialog } from "../leads/LeadDialog";
import {
  FUNNEL_STAGES,
  LEAD_STAGES,
  followUpLabel,
  leadCompany,
  leadName,
  leadsApi,
  NEXT_ACTION,
  PAGE_SIZE,
  STAGE_META,
  type Lead,
  type LeadStage,
} from "../leads/api";
import { ApiError } from "../lib/api";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
} from "../ui";

/** Urgency views come first, then the stages — the brief's filter order. */
const FILTERS: { key: string; label: string; tone?: "overdue" | "due" }[] = [
  { key: "overdue", label: "Overdue", tone: "overdue" },
  { key: "due_today", label: "Due today", tone: "due" },
  { key: "", label: "All" },
  ...LEAD_STAGES.filter((s) => s !== "converted" && s !== "dropped").map((s) => ({
    key: s,
    label: STAGE_META[s].label,
  })),
  { key: "converted", label: "Converted" },
];

export default function Leads() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<{ lead: Lead | null } | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [booking, setBooking] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["leads", filter, offset],
    queryFn: () => leadsApi.list(offset, filter),
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const counts = page?.counts ?? {};
  const total = page?.total ?? 0;
  const showing = page?.items.length ?? 0;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const advance = useMutation({
    mutationFn: ({ id, toStage, followUpAt }: { id: string; toStage: LeadStage; followUpAt?: string }) =>
      leadsApi.advance(id, { toStage, followUpAt }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not update that lead"),
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Parameters<typeof leadsApi.create>[0] }) =>
      id ? leadsApi.update(id, input) : leadsApi.create(input),
    onSuccess: invalidate,
  });

  const convert = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof leadsApi.convert>[1] }) =>
      leadsApi.convert(id, input),
    onSuccess: (result) => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      // Land on the deal that was just created — the point of converting.
      navigate("/deals");
      void result;
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: invalidate,
  });

  const onAction = (lead: Lead) => {
    const action = NEXT_ACTION[lead.stage];
    if (!action) return;
    if (action.convert) {
      setConverting(lead);
      return;
    }
    // Booking a call has to ask when, or the lead drops out of the urgency sort.
    if (action.needsDate) {
      setBooking(lead);
      return;
    }
    advance.mutate({ id: lead.id, toStage: action.toStage });
  };

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Leads"
        subtitle="Outreach only — a lead hands off to a deal rather than closing."
        action={
          <Button icon="plus" onClick={() => setDialog({ lead: null })}>
            New lead
          </Button>
        }
      />

      <FunnelStrip counts={counts} onPick={(s) => { setFilter(s); setOffset(0); }} />

      <div className="flex flex-wrap gap-xs">
        {FILTERS.map((f) => {
          const n = f.key === "" ? undefined : counts[f.key];
          const active = filter === f.key;
          return (
            <button
              key={f.key || "all"}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setOffset(0);
              }}
              className={`rounded-full px-md py-xs text-xs font-medium transition-colors duration-100 ${
                active
                  ? f.tone === "overdue"
                    ? "bg-bad-solid text-white"
                    : f.tone === "due"
                      ? "bg-warning-500 text-white"
                      : "bg-accent text-white"
                  : f.tone === "overdue" && n
                    ? "bg-bad-soft text-bad-fg hover:bg-bad-soft/70"
                    : f.tone === "due" && n
                      ? "bg-warn-soft text-warn-fg hover:bg-warn-soft/70"
                      : "bg-surface-muted text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              {f.label}
              {n !== undefined && n > 0 && <span className="ml-xs tabular-nums">({n})</span>}
            </button>
          );
        })}
      </div>

      {error && <Alert>{error}</Alert>}
      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load leads"}
        </Alert>
      )}

      {query.isPending ? (
        <Card padded={false} className="p-md">
          <div className="flex flex-col gap-sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[48px] w-full" />
            ))}
          </div>
        </Card>
      ) : showing === 0 ? (
        <EmptyState
          icon="leads"
          title={filter ? "Nothing here" : "No leads yet"}
          description={
            filter
              ? "No leads match this filter right now."
              : "A lead is a person you're reaching out to, before there's a deal."
          }
          hints={filter ? undefined : ["Follow-up dates", "One-click next step", "Convert to a deal"]}
          action={
            <Button icon="plus" size="sm" onClick={() => setDialog({ lead: null })}>
              New lead
            </Button>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-lg py-sm font-medium">Lead</th>
                  <th className="px-lg py-sm font-medium">Company</th>
                  <th className="px-lg py-sm font-medium">Stage</th>
                  <th className="px-lg py-sm font-medium">Contacted</th>
                  <th className="px-lg py-sm font-medium">Follow-up</th>
                  <th className="px-lg py-sm font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {page!.items.map((lead) => (
                  <Row
                    key={lead.id}
                    lead={lead}
                    busy={advance.isPending}
                    onOpen={() => setDialog({ lead })}
                    onAction={() => onAction(lead)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between">
          <span className="text-xs tabular-nums text-fg-muted">
            {offset + 1}–{offset + showing} of {total}
          </span>
          <div className="flex gap-sm">
            <Button
              variant="secondary"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={offset + showing >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}

      {dialog && (
        <LeadDialog
          lead={dialog.lead}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.lead?.id, input })}
          onDelete={
            dialog.lead
              ? () => {
                  if (window.confirm("Delete this lead?")) {
                    remove.mutate(dialog.lead!.id);
                    setDialog(null);
                  }
                }
              : undefined
          }
        />
      )}

      {converting && (
        <ConvertDialog
          lead={converting}
          onClose={() => setConverting(null)}
          onSubmit={(input) => convert.mutateAsync({ id: converting.id, input })}
        />
      )}

      {booking && (
        <BookCallDialog
          lead={booking}
          onClose={() => setBooking(null)}
          onSubmit={(date) => {
            advance.mutate({ id: booking.id, toStage: "call_booked", followUpAt: date });
            setBooking(null);
          }}
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/** The brief's compressed New → … → Call done strip, doubling as a filter. */
function FunnelStrip({
  counts,
  onPick,
}: {
  counts: Record<string, number>;
  onPick: (stage: string) => void;
}) {
  return (
    <Card className="overflow-x-auto">
      <div className="flex min-w-[520px] items-stretch gap-xs">
        {FUNNEL_STAGES.map((stage, i) => (
          <div key={stage} className="flex flex-1 items-center gap-xs">
            <button
              type="button"
              onClick={() => onPick(stage)}
              className="flex-1 rounded-md border border-line px-md py-sm text-left transition-colors hover:border-accent/50 hover:bg-surface-hover"
            >
              <span className="block text-lg font-semibold tabular-nums text-fg">
                {counts[stage] ?? 0}
              </span>
              <span className="block text-xs text-fg-muted">{STAGE_META[stage].label}</span>
            </button>
            {i < FUNNEL_STAGES.length - 1 && (
              <span className="shrink-0 text-fg-subtle">→</span>
            )}
          </div>
        ))}

        <div className="flex items-center gap-xs">
          <span className="shrink-0 text-fg-subtle">→</span>
          <button
            type="button"
            onClick={() => onPick("converted")}
            className="rounded-md border border-ok-fg/30 bg-ok-soft px-md py-sm text-left transition-colors hover:bg-ok-soft/70"
          >
            <span className="block text-lg font-semibold tabular-nums text-ok-fg">
              {counts.converted ?? 0}
            </span>
            <span className="block text-xs text-ok-fg">Converted</span>
          </button>
        </div>
      </div>
    </Card>
  );
}

function Row({
  lead,
  onOpen,
  onAction,
  busy,
}: {
  lead: Lead;
  onOpen: () => void;
  onAction: () => void;
  busy: boolean;
}) {
  const action = NEXT_ACTION[lead.stage];
  const follow = followUpLabel(lead);
  const meta = STAGE_META[lead.stage];
  const company = leadCompany(lead);

  return (
    <tr
      // Overdue rows get a subtle red wash so the queue reads at a glance.
      className={`border-b border-line transition-colors duration-100 last:border-0 ${
        lead.overdue ? "bg-bad-soft/40 hover:bg-bad-soft/60" : "hover:bg-surface-hover"
      }`}
    >
      <td className="px-lg py-sm">
        <button onClick={onOpen} className="flex items-center gap-sm text-left">
          <Avatar name={leadName(lead)} size="xs" />
          <span className="min-w-0">
            <span className="block font-medium text-fg">{leadName(lead)}</span>
            {lead.title && <span className="block text-xs text-fg-muted">{lead.title}</span>}
          </span>
        </button>
      </td>

      <td className="px-lg py-sm">
        {company ? (
          <>
            <span className="block text-fg-muted">{company}</span>
            {lead.accountIndustry && (
              <span className="block text-xs text-fg-subtle">{lead.accountIndustry}</span>
            )}
          </>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </td>

      <td className="px-lg py-sm">
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </td>

      <td className="px-lg py-sm text-xs text-fg-muted">
        {lead.lastContactedAt
          ? new Date(lead.lastContactedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })
          : "—"}
      </td>

      <td
        className={`px-lg py-sm text-xs ${
          follow.tone === "overdue"
            ? "font-medium text-bad-fg"
            : follow.tone === "due"
              ? "font-medium text-warn-fg"
              : "text-fg-muted"
        }`}
      >
        {follow.text}
      </td>

      <td className="px-lg py-sm">
        {action ? (
          <Button
            variant={action.convert ? "primary" : "secondary"}
            size="sm"
            disabled={busy}
            onClick={onAction}
          >
            {action.label}
            <Icon name="chevronLeft" size={12} className="rotate-180" />
          </Button>
        ) : (
          <span className="text-xs text-fg-subtle">
            {lead.stage === "converted" ? "Converted" : "—"}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Booking a call asks when, so the lead keeps its place in the urgency sort. */
function BookCallDialog({
  lead,
  onClose,
  onSubmit,
}: {
  lead: Lead;
  onClose: () => void;
  onSubmit: (isoDate: string) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));

  return (
    <Card className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-lg w-[min(420px,calc(100%-2rem))] shadow-lg">
      <p className="text-sm font-medium text-fg">Book a call with {leadName(lead)}</p>
      <p className="mt-xs text-xs text-fg-muted">
        Sets the follow-up date so the lead stays in the queue.
      </p>
      <div className="mt-md flex items-end gap-sm">
        <label className="flex flex-1 flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">Call date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-[36px] w-full rounded-md border border-line bg-surface px-md text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!date} onClick={() => onSubmit(`${date}T00:00:00Z`)}>
          Book
        </Button>
      </div>
    </Card>
  );
}

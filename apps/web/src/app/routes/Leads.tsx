import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  UploadCloud,
  Plus,
  GitBranch,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  X,
  ChevronDown,
  Building2,
  Calendar,
  Clock,
  Edit3,
  ExternalLink,
  Trash2,
  UserX,
  RotateCcw,
} from "lucide-react";
import { MermaidDiagram } from "../components/ui/MermaidDiagram";
import { leadLifecycleChart } from "../lib/pipeline-charts";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { ConvertDialog } from "../leads/ConvertDialog";
import { LeadDialog } from "../leads/LeadDialog";
import { ImportWizardModal } from "../leads/ImportWizardModal";
import {
  FUNNEL_STAGES,
  type Meeting,
  followUpLabel,
  leadCompany,
  leadName,
  leadsApi,
  NEXT_ACTION,
  PAGE_SIZE,
  STAGE_META,
  type Lead,
  type LeadInput,
  type LeadStage,
} from "../leads/api";
import { ApiError } from "../lib/api";
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
} from "../ui";


export default function Leads() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currency = useCurrency();

  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<{
    lead: Lead | null;
    initialState?: Partial<LeadInput>;
  } | null>(null);
  const [converting, setConverting] = useState<Lead | null>(null);
  const [booking, setBooking] = useState<Lead | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.new) {
      setDialog({
        lead: null,
        initialState: {
          accountId: location.state.accountId,
          company: location.state.accountName,
        },
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const query = useQuery({
    queryKey: ["leads", filter, offset],
    queryFn: () => leadsApi.list(offset, filter),
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const counts = page?.counts ?? {};
  const total = page?.total ?? 0;
  const rawItems = page?.items ?? [];

  const filteredItems = rawItems.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      leadName(l).toLowerCase().includes(q) ||
      (leadCompany(l) ?? "").toLowerCase().includes(q) ||
      (l.title ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q)
    );
  });
  const showing = filteredItems.length;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const advance = useMutation({
    mutationFn: ({
      id,
      toStage,
      followUpAt,
      meetingAt,
      meetingMinutes,
      attendees,
      inviteConfirmed,
      clearFollowUp,
    }: {
      id: string;
      toStage: LeadStage;
      followUpAt?: string;
      meetingAt?: string;
      meetingMinutes?: number;
      attendees?: string[];
      inviteConfirmed?: boolean;
      clearFollowUp?: boolean;
    }) =>
      leadsApi.advance(id, {
        toStage,
        followUpAt,
        meetingAt,
        meetingMinutes,
        attendees,
        inviteConfirmed,
        clearFollowUp,
      }),
    onSuccess: (result) => {
      setError(null);
      setMeeting(result.meeting ?? null);
      invalidate();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : "Could not update that lead",
      ),
  });

  const save = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string;
      input: Parameters<typeof leadsApi.create>[0];
    }) => (id ? leadsApi.update(id, input) : leadsApi.create(input)),
    onSuccess: invalidate,
  });

  const convert = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof leadsApi.convert>[1];
    }) => leadsApi.convert(id, input),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate("/deals");
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
    if (action.needsDate) {
      setBooking(lead);
      return;
    }
    advance.mutate({ id: lead.id, toStage: action.toStage });
  };

  const onDropLead = (lead: Lead) => {
    advance.mutate({
      id: lead.id,
      toStage: "not interested",
      clearFollowUp: true,
    });
  };

  const onReopenLead = (lead: Lead) => {
    advance.mutate({
      id: lead.id,
      toStage: "new",
    });
  };

  const onStageSelect = (lead: Lead, targetStage: LeadStage) => {
    if (targetStage === "converted") {
      setConverting(lead);
      return;
    }
    if (targetStage === "call scheduled") {
      setBooking(lead);
      return;
    }
    if (targetStage === "not interested") {
      onDropLead(lead);
      return;
    }
    advance.mutate({ id: lead.id, toStage: targetStage });
  };

  const handleNodeClick = (nodeId: string) => {
    if (nodeId === "CV") {
      setFilter("converted");
      setOffset(0);
      return;
    }
    const nodeMap: Record<string, string> = {
      NW: "new",
      IC: "initial count",
      DS: "deck sent",
      CS: "call scheduled",
      CD: "call done",
      PS: "proposal sent",
      NI: "not interested",
    };
    const targetStage = nodeMap[nodeId];
    if (targetStage) {
      setFilter(targetStage);
      setOffset(0);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Leads Pipeline"
        subtitle="Manage prospects, outreach stages, and convert qualified leads into active deals."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg hover:bg-surface-hover transition shadow-xs cursor-pointer"
            >
              <UploadCloud className="h-4 w-4 text-indigo-500" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => setDialog({ lead: null })}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-md cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Lead</span>
            </button>
          </div>
        }
      />

      {/* Lead Lifecycle Collapsible Chart */}
      <details className="group rounded-2xl border border-line bg-surface shadow-xs transition-all overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between p-4 font-bold text-sm select-none hover:text-indigo-600 transition-colors text-fg list-none">
          <div className="flex items-center gap-2.5">
            <GitBranch className="h-4 w-4 text-indigo-600" />
            <span>Lead Lifecycle & Conversion Pipeline</span>
          </div>
          <ChevronDown className="h-4 w-4 text-fg-subtle group-open:rotate-180 transition-transform duration-200" />
        </summary>
        <div className="border-t border-line p-4 bg-surface-muted/30">
          <MermaidDiagram
            chart={leadLifecycleChart(counts as Record<string, number>)}
            onNodeClick={handleNodeClick}
          />
        </div>
      </details>

      {/* Single Unified Funnel Overview & Search Bar */}
      <FunnelStrip
        counts={counts}
        activeStage={filter}
        onPick={(s) => {
          setFilter(s);
          setOffset(0);
        }}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setOffset(0);
        }}
      />

      {error && <Alert>{error}</Alert>}
      {meeting && (
        <Card className="flex flex-wrap items-center justify-between gap-sm">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">Google Meet booked</p>
            <p className="mt-xs truncate text-xs text-fg-muted">
              {meeting.title} — {new Date(meeting.startAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-sm">
            {meeting.meetLink && (
              <a
                href={meeting.meetLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent underline"
              >
                Open Meet link
              </a>
            )}
            <Button variant="secondary" onClick={() => setMeeting(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError
            ? query.error.message
            : "Could not load leads"}
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
              : "A lead is a person or account you're reaching out to, before there's a deal."
          }
          hints={
            filter
              ? undefined
              : ["Follow-up dates", "One-click next step", "Convert to a deal"]
          }
          action={
            <Button
              icon="plus"
              size="sm"
              onClick={() => setDialog({ lead: null })}
            >
              New lead
            </Button>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden border border-line shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted/80 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-5 py-3.5 w-[24%]">Lead Contact</th>
                  <th className="px-5 py-3.5 w-[18%]">Company</th>
                  <th className="px-5 py-3.5 w-[11%] whitespace-nowrap">Est. Value</th>
                  <th className="px-5 py-3.5 w-[13%] whitespace-nowrap">Stage</th>
                  <th className="px-5 py-3.5 w-[10%] whitespace-nowrap">Contacted</th>
                  <th className="px-5 py-3.5 w-[10%] whitespace-nowrap">Follow-up</th>
                  <th className="px-5 py-3.5 w-[14%] whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredItems.map((lead) => (
                  <Row
                    key={lead.id}
                    lead={lead}
                    currency={currency}
                    busy={advance.isPending}
                    onOpen={() => setDialog({ lead })}
                    onAction={() => onAction(lead)}
                    onConvert={() => setConverting(lead)}
                    onViewDeal={() => navigate("/deals")}
                    onDrop={() => onDropLead(lead)}
                    onReopen={() => onReopenLead(lead)}
                    onStageSelect={(stage) => onStageSelect(lead, stage)}
                    onDelete={() => {
                      if (window.confirm(`Delete lead "${leadName(lead)}"?`)) {
                        remove.mutate(lead.id);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ImportWizardModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          setIsImportOpen(false);
          invalidate();
        }}
      />

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
          initialState={dialog.initialState}
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
          onSubmit={(input) =>
            convert.mutateAsync({ id: converting.id, input })
          }
        />
      )}

      {booking && (
        <BookCallDialog
          lead={booking}
          onClose={() => setBooking(null)}
          onSubmit={(date, meetingAt, minutes, attendees, inviteConfirmed) => {
            advance.mutate({
              id: booking.id,
              toStage: "call scheduled",
              followUpAt: date,
              meetingAt,
              meetingMinutes: minutes,
              attendees,
              inviteConfirmed,
            });
            setBooking(null);
          }}
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/** Interactive Funnel stage cards. */
function FunnelStrip({
  counts,
  activeStage,
  onPick,
  searchQuery,
  onSearchChange,
}: {
  counts: Record<string, number>;
  activeStage: string;
  onPick: (stage: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  const totalProspects = Object.entries(counts)
    .filter(([k]) => k !== "overdue" && k !== "due_today")
    .reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs flex flex-col gap-3.5">
      {/* Top Bar: Title, Total badge, Search Input, and Urgency / Reset filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
            Funnel Overview
          </span>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {totalProspects} Total In Pipeline
          </span>
        </div>

        {/* Integrated Search Bar */}
        <div className="relative flex-1 min-w-64 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-fg-subtle" />
          <input
            type="text"
            placeholder="Search leads by name, title, company, email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-muted/60 pl-9 pr-8 py-2 text-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-fg placeholder:text-fg-subtle"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2.5 text-fg-subtle hover:text-fg cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPick("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeStage === ""
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-fg-muted hover:text-fg hover:bg-surface-muted"
            }`}
          >
            All Leads
          </button>

          {(counts.overdue ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => onPick(activeStage === "overdue" ? "" : "overdue")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeStage === "overdue"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Overdue {counts.overdue}</span>
            </button>
          )}

          {(counts.due_today ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => onPick(activeStage === "due_today" ? "" : "due_today")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeStage === "due_today"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>Due today {counts.due_today}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {FUNNEL_STAGES.map((stage) => {
          const count = counts[stage] ?? 0;
          const active = activeStage === stage;
          const meta = STAGE_META[stage];

          return (
            <button
              key={stage}
              type="button"
              onClick={() => onPick(active ? "" : stage)}
              className={`flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                active
                  ? "border-indigo-500 bg-indigo-500/10 shadow-xs ring-2 ring-indigo-500/20"
                  : "border-line/70 bg-surface-muted/40 hover:bg-surface-muted hover:border-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-fg-muted truncate">
                  {meta?.label ?? stage}
                </span>
                <span className={`h-1.5 w-1.5 rounded-full ${meta?.bar ?? "bg-neutral-400"}`} />
              </div>
              <span className="text-lg font-extrabold tabular-nums text-fg">
                {count}
              </span>
            </button>
          );
        })}

        {/* Converted Stage */}
        <button
          type="button"
          onClick={() => onPick(activeStage === "converted" ? "" : "converted")}
          className={`flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
            activeStage === "converted"
              ? "border-emerald-500 bg-emerald-500/15 shadow-xs ring-2 ring-emerald-500/20"
              : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Converted
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-lg font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
            {counts.converted ?? 0}
          </span>
        </button>

        {/* Not Interested Stage */}
        <button
          type="button"
          onClick={() => onPick(activeStage === "not interested" ? "" : "not interested")}
          className={`flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
            activeStage === "not interested"
              ? "border-rose-500 bg-rose-500/15 shadow-xs ring-2 ring-rose-500/20"
              : "border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
              Not Interested
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          </div>
          <span className="text-lg font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
            {counts["not interested"] ?? 0}
          </span>
        </button>
      </div>
    </div>
  );
}

function Row({
  lead,
  currency,
  onOpen,
  onAction,
  onConvert,
  onViewDeal,
  onDrop,
  onReopen,
  onStageSelect,
  onDelete,
  busy,
}: {
  lead: Lead;
  currency: string;
  onOpen: () => void;
  onAction: () => void;
  onConvert: () => void;
  onViewDeal: () => void;
  onDrop: () => void;
  onReopen: () => void;
  onStageSelect: (stage: LeadStage) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const action = NEXT_ACTION[lead.stage];
  const follow = followUpLabel(lead);
  const meta = STAGE_META[lead.stage] ?? {
    label: lead.stage,
    tone: "neutral" as const,
  };
  const company = leadCompany(lead);
  const isConverted =
    lead.stage === "converted" ||
    lead.stage === "closed" ||
    Boolean(lead.convertedDealId) ||
    Boolean(lead.convertedAt);

  return (
    <tr
      className={`group transition-colors duration-100 ${
        lead.stage === "not interested"
          ? "bg-rose-500/[0.02] hover:bg-rose-500/[0.06]"
          : lead.overdue
          ? "bg-rose-500/5 hover:bg-rose-500/10"
          : "hover:bg-surface-hover/70"
      }`}
    >
      {/* Lead Contact */}
      <td className="px-5 py-3.5">
        <div className="flex items-start gap-3">
          <Avatar name={leadName(lead)} size="sm" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="text-left font-bold text-fg hover:text-indigo-600 transition-colors text-sm cursor-pointer block"
            >
              {leadName(lead)}
            </button>
            {lead.title && (
              <p className="truncate text-xs text-fg-muted font-normal mt-0.5">
                {lead.title}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  title={`Email ${lead.email}`}
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[260px]">{lead.email}</span>
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-fg-subtle hover:text-fg font-medium"
                  title={`Call ${lead.phone}`}
                >
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{lead.phone}</span>
                </a>
              )}
              {lead.linkedinUrl && (
                <a
                  href={
                    lead.linkedinUrl.startsWith("http")
                      ? lead.linkedinUrl
                      : `https://${lead.linkedinUrl}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium"
                  title="Open LinkedIn profile"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="px-5 py-3.5">
        {company ? (
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-fg-subtle mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="block font-semibold text-fg text-sm truncate max-w-[260px]">
                {company}
              </span>
              {lead.accountIndustry && (
                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-surface-muted text-fg-subtle border border-line/40">
                  {lead.accountIndustry}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-fg-subtle text-sm">—</span>
        )}
      </td>

      {/* Est. Value */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        {lead.value ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold tabular-nums text-xs border border-indigo-500/20">
            {formatMoneyCompact(lead.value, currency)}
          </span>
        ) : (
          <span className="text-fg-subtle text-xs">—</span>
        )}
      </td>

      {/* Interactive Stage Selector */}
      <td className="px-5 py-3.5 whitespace-nowrap">
        <div className="relative inline-flex items-center">
          <select
            value={lead.stage}
            disabled={busy || isConverted}
            onChange={(e) => onStageSelect(e.target.value as LeadStage)}
            className={`appearance-none cursor-pointer text-xs font-bold pl-5 pr-6 py-1.5 rounded-full border transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed ${
              lead.stage === "not interested"
                ? "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 focus:ring-rose-500"
                : isConverted
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-500"
                : lead.stage === "proposal sent" || lead.stage === "call done"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 focus:ring-emerald-500"
                : lead.stage === "call scheduled"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300 focus:ring-amber-500"
                : lead.stage === "deck sent"
                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300 focus:ring-indigo-500"
                : lead.stage === "initial count"
                ? "bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300 focus:ring-sky-500"
                : "bg-surface-muted border-line text-fg-muted hover:text-fg focus:ring-indigo-500"
            }`}
            title="Change stage"
          >
            <option value="new">New</option>
            <option value="initial count">Initial Count</option>
            <option value="deck sent">Deck Sent</option>
            <option value="call scheduled">Call Scheduled</option>
            <option value="call done">Call Done</option>
            <option value="proposal sent">Proposal Sent</option>
            <option value="converted">Convert to Deal...</option>
            <option value="not interested">Not Interested (Drop)</option>
          </select>
          <span
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${
              lead.stage === "not interested"
                ? "bg-rose-500"
                : isConverted
                ? "bg-emerald-500"
                : meta.bar || "bg-indigo-500"
            }`}
          />
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle pointer-events-none" />
        </div>
      </td>

      {/* Contacted */}
      <td className="px-5 py-3.5 text-xs text-fg-muted tabular-nums whitespace-nowrap">
        {lead.lastContactedAt
          ? new Date(lead.lastContactedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })
          : "—"}
      </td>

      {/* Follow-up */}
      <td className="px-5 py-3.5 text-xs tabular-nums whitespace-nowrap">
        {lead.stage === "not interested" ? (
          <span className="text-fg-subtle text-xs">No follow-up</span>
        ) : follow.tone === "overdue" ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{follow.text}</span>
          </span>
        ) : follow.tone === "due" ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{follow.text}</span>
          </span>
        ) : lead.followUpAt ? (
          <span className="inline-flex items-center gap-1 text-fg-muted">
            <Calendar className="h-3 w-3 text-fg-subtle shrink-0" />
            <span>{follow.text}</span>
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-3.5 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          {lead.stage === "not interested" ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <UserX className="h-3.5 w-3.5" />
                <span>Not Interested</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={onReopen}
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface hover:bg-surface-hover px-2.5 py-1.5 text-xs font-semibold text-fg-muted hover:text-fg transition-colors cursor-pointer"
                title="Reopen lead (move back to New stage)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reopen</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConvert}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                title="Convert to Deal"
              >
                <span>Convert</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : isConverted ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Converted
              </span>
              <button
                type="button"
                onClick={onViewDeal}
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface hover:bg-surface-hover px-2.5 py-1.5 text-xs font-semibold text-fg-muted hover:text-fg transition-colors cursor-pointer"
                title="View on Deals Board"
              >
                <span>View Deal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {action && (
                <Button
                  variant={action.convert ? "primary" : "secondary"}
                  size="sm"
                  disabled={busy}
                  onClick={onAction}
                >
                  {action.label}
                  <Icon name="chevronLeft" size={12} className="rotate-180" />
                </Button>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={onConvert}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                title="Convert to Deal"
              >
                <span>Convert</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={onDrop}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                title="Drop Lead / Mark Not Interested"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Drop</span>
              </button>
            </div>
          )}

          {/* Quick Row Tools: Edit & Delete */}
          <div className="flex items-center gap-0.5 border-l border-line/60 pl-1.5 ml-0.5">
            <button
              type="button"
              onClick={onOpen}
              className="p-1.5 rounded-lg text-fg-subtle hover:text-indigo-600 hover:bg-surface-muted transition cursor-pointer"
              title="Edit lead"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-fg-subtle hover:text-rose-600 hover:bg-rose-500/10 transition cursor-pointer"
              title="Delete lead"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
  onSubmit: (
    isoDate: string,
    meetingAt: string,
    minutes: number,
    attendees: string[],
    inviteConfirmed: boolean,
  ) => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState(30);
  const [inviteLead, setInviteLead] = useState(false);

  const field =
    "h-[38px] w-full rounded-xl border border-line bg-surface px-3 text-xs text-fg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  const meetingAt = new Date(`${date}T${time}`).toISOString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-line">
          <div>
            <h3 className="text-base font-bold text-fg">
              Book a call with {leadName(lead)}
            </h3>
            <p className="text-xs text-fg-muted mt-0.5">
              Sets follow-up date and books a Google Calendar event with a Meet link.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-muted transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface-muted/60 p-3.5 mb-4">
          {lead.email ? (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inviteLead}
                onChange={(e) => setInviteLead(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line text-indigo-600 focus:ring-indigo-500"
              />
              <div className="min-w-0">
                <span className="block text-xs font-semibold text-fg">
                  Email calendar invitation to {leadName(lead)}
                </span>
                <span className="block truncate text-xs text-indigo-600 dark:text-indigo-400">
                  {lead.email}
                </span>
              </div>
            </label>
          ) : (
            <p className="text-xs text-fg-muted">
              {leadName(lead)} has no email address on file. The meeting will be booked on your calendar with a Meet link to share manually.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg-muted">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg-muted">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-fg-muted">Length</span>
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className={field}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!date || !time}
            onClick={() =>
              onSubmit(
                `${date}T00:00:00Z`,
                meetingAt,
                minutes,
                inviteLead && lead.email ? [lead.email] : [],
                inviteLead && Boolean(lead.email),
              )
            }
          >
            {inviteLead && lead.email ? "Book and send invite" : "Book with Meet"}
          </Button>
        </div>
      </div>
    </div>
  );
}

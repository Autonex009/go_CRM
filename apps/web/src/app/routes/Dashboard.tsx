import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Handshake,
  FileText,
  Building2,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertCircle,
} from "lucide-react";

import { KIND_META, relativeTime, type ActivityKind } from "../activities/api";
import { useAuthStore } from "../auth/store";
import { STAGE_META as DEAL_META, stageLabel as dealStageLabel } from "../deals/stages";
import { STAGE_META as LEAD_META, stageLabel as leadStageLabel } from "../leads/api";
import { ApiError } from "../lib/api";
import { dashboardApi, type Attention, type Pipeline, type Recent, type Summary } from "../lib/dashboard";
import { formatMoney, formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import {
  Alert,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  Icon,
  Skeleton,
  buttonClass,
  type IconName,
  type Tone,
} from "../ui";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const currency = useCurrency();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.summary,
    staleTime: 30_000,
  });
  const data = query.data;

  const firstName = user?.name?.trim().split(" ")[0] ?? user?.email?.split("@")[0];

  const winRate = useMemo(() => {
    if (!data || data.deals.total === 0) return undefined;
    const won = data.deals.stages.find((s) => s.stage === "won")?.count ?? 0;
    return `${Math.round((won / data.deals.total) * 100)}% win rate`;
  }, [data]);

  const untouched =
    !!data &&
    data.leads.total + data.deals.total + data.quotes.total + data.invoices.total === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h1 className="text-xl font-bold tracking-tight text-fg">
                {firstName ? `Welcome back, ${firstName}!` : "Dashboard Overview"}
              </h1>
            </div>
            <p className="text-xs text-fg-muted">
              {untouched
                ? "Let's get your workspace set up and launch your first pipeline."
                : "Here is your real-time revenue performance and active pipeline metrics."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/leads"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Explore Leads</span>
            </Link>
          </div>
        </div>
      </div>

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load the dashboard"}
        </Alert>
      )}

      {query.isPending ? (
        <DashboardSkeleton />
      ) : untouched ? (
        <FirstRun data={data} />
      ) : (
        data && (
          <>
            {/* KPI Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Open Deals"
                value={formatMoney(data.deals.open, currency)}
                subtitle={winRate ?? "Active Pipeline"}
                icon={Handshake}
                color="indigo"
                to="/deals"
              />
              <KpiCard
                title="Lead Pipeline"
                value={formatMoney(data.leads.open, currency)}
                subtitle={`${data.leads.total} total lead${data.leads.total === 1 ? "" : "s"}`}
                icon={TrendingUp}
                color="purple"
                to="/leads"
              />
              <KpiCard
                title="Quotes Active"
                value={formatMoney(data.quotes.open, currency)}
                subtitle={`${data.quotes.total} quote${data.quotes.total === 1 ? "" : "s"}`}
                icon={FileText}
                color="amber"
                to="/quotes"
              />
              <KpiCard
                title="Outstanding Invoices"
                value={formatMoney(data.invoices.outstanding, currency)}
                subtitle={
                  data.invoices.overdue > 0
                    ? `${formatMoney(data.invoices.overdue, currency)} overdue`
                    : `${formatMoney(data.invoices.paid, currency)} collected`
                }
                icon={Building2}
                color="emerald"
                to="/invoices"
              />
            </div>

            {/* Split Grid */}
            <div className="grid gap-6 lg:grid-cols-12">
              <AttentionCard
                className="lg:col-span-7"
                items={data.attention}
                currency={currency}
              />
              <PipelineCard
                className="lg:col-span-5"
                currency={currency}
                title="Lead Funnel"
                subtitle="Stage distribution across outreach"
                to="/leads"
                pipeline={data.leads}
                meta={LEAD_META}
                label={leadStageLabel}
                emptyIcon="leads"
                emptyText="No leads registered yet."
              />
              <RecentCard className="lg:col-span-7" items={data.recent} />
              <PipelineCard
                className="lg:col-span-5"
                currency={currency}
                title="Deals by Stage"
                subtitle="Stage distribution across active revenue"
                to="/deals"
                pipeline={data.deals}
                meta={DEAL_META}
                label={dealStageLabel}
                emptyIcon="deals"
                emptyText="No deals in pipeline yet."
              />
            </div>
          </>
        )
      )}
    </motion.section>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: IconComp,
  color,
  to,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: "indigo" | "purple" | "amber" | "emerald";
  to: string;
}) {
  const colorMap = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-500 border-indigo-500/20",
    purple: "from-purple-500/20 to-purple-500/5 text-purple-500 border-purple-500/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/20",
  };

  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted">{title}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br border ${colorMap[color]}`}>
          <IconComp className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight text-fg">{value}</h3>
        <p className="mt-1 text-xs text-fg-muted">{subtitle}</p>
      </div>
    </Link>
  );
}


/* -------------------------------------------------------------------------- */
/* First run                                                                  */
/* -------------------------------------------------------------------------- */

interface Step {
  label: string;
  description: string;
  icon: IconName;
  to: string;
  done: boolean;
}

/**
 * The setup guide a brand-new workspace opens on.
 *
 * Every step's `done` is derived from real data rather than stored progress, so
 * it cannot disagree with the workspace, and deleting everything honestly puts
 * the guide back.
 */
function FirstRun({ data }: { data: Summary }) {
  const steps: Step[] = [
    {
      label: "Add your first lead",
      description: "A person you're reaching out to, before there's a deal.",
      icon: "leads",
      to: "/leads",
      done: data.leads.total > 0,
    },
    {
      label: "Log what happened",
      description: "Outreach, a reply, a booked call — the timeline is the record.",
      icon: "mail",
      to: "/leads",
      done: data.recent.length > 0,
    },
    {
      label: "Convert a lead to a deal",
      description: "Once a call is done, hand it off with an amount attached.",
      icon: "deals",
      to: "/deals",
      done: data.deals.total > 0,
    },
    {
      label: "Send a quote",
      description: "Line items, discounts and tax, priced in your currency.",
      icon: "trend",
      to: "/quotes",
      done: data.quotes.total > 0,
    },
    {
      label: "Raise an invoice",
      description: "Bill a won deal and track what's still owed.",
      icon: "building",
      to: "/invoices",
      done: data.invoices.total > 0,
    },
    {
      label: "Invite your team",
      description: "Everyone shares one workspace and one pipeline.",
      icon: "team",
      to: "/team",
      done: data.members > 1,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  // The first unfinished step is the one to nudge; everything after it waits.
  const nextIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="grid gap-md lg:grid-cols-12">
      <Card className="lg:col-span-7" padded={false}>
        <div className="flex items-center justify-between gap-md p-lg pb-md">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">Set up your workspace</h2>
            <p className="mt-[2px] text-xs text-fg-muted">
              Each step lights up on its own as you work — nothing to tick off.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-fg-muted">
            {done} / {steps.length}
          </span>
        </div>

        {/* Progress: a track and a fill, two elements, no component. */}
        <div className="mx-lg h-[4px] overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>

        <ol className="mt-md flex flex-col">
          {steps.map((step, i) => (
            <li key={step.label}>
              <Link
                to={step.to}
                className={`flex items-start gap-md border-t border-line px-lg py-md transition-colors duration-100 hover:bg-surface-hover ${
                  i === nextIndex ? "bg-accent-soft/40" : ""
                }`}
              >
                <span
                  className={`mt-[1px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    step.done
                      ? "bg-ok-soft text-ok-fg"
                      : i === nextIndex
                        ? "bg-accent text-white"
                        : "bg-surface-muted text-fg-subtle"
                  }`}
                >
                  {step.done ? <Icon name="check" size={13} /> : i + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      step.done ? "text-fg-muted line-through" : "text-fg"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="mt-[1px] block text-xs text-fg-muted">{step.description}</span>
                </span>

                {!step.done && i === nextIndex && (
                  <span className="mt-[2px] shrink-0 text-xs font-medium text-accent">Start →</span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader
          title="How the pieces fit"
          subtitle="One path, from a name to money in the bank."
        />
        <ol className="mt-lg flex flex-col gap-md">
          {FLOW.map((item, i) => (
            <li key={item.label} className="flex gap-md">
              <span className="flex flex-col items-center">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-surface-muted text-fg-muted">
                  <Icon name={item.icon} size={14} />
                </span>
                {i < FLOW.length - 1 && <span className="mt-[2px] h-full w-px flex-1 bg-line" />}
              </span>
              <span className="min-w-0 pb-md">
                <span className="block text-sm font-medium text-fg">{item.label}</span>
                <span className="mt-[1px] block text-xs text-fg-muted">{item.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/** The product in six lines — shown while there's no data to show instead. */
const FLOW: { label: string; detail: string; icon: IconName }[] = [
  { label: "Lead", detail: "Someone worth contacting.", icon: "leads" },
  { label: "Outreach", detail: "Email, reply, call booked — each one logged.", icon: "mail" },
  { label: "Deal", detail: "A real opportunity, with an amount and a close date.", icon: "deals" },
  { label: "Quote", detail: "What you're offering, priced.", icon: "trend" },
  { label: "Invoice", detail: "What they owe, and what's been paid.", icon: "building" },
];

/* -------------------------------------------------------------------------- */
/* Needs attention                                                            */
/* -------------------------------------------------------------------------- */

const ATTENTION_META: Record<Attention["kind"], { icon: IconName; href: (id: string) => string }> = {
  lead: { icon: "leads", href: () => "/leads" },
  quote: { icon: "trend", href: (id) => `/quotes/${id}` },
  invoice: { icon: "building", href: (id) => `/invoices/${id}` },
};

/** "3 days overdue" / "Due today" / "in 2 days", plus how loudly to say it. */
function dueLabel(days: number): { text: string; tone: "bad" | "warn" | "plain" } {
  if (days < 0) {
    const n = -days;
    return { text: `${n} day${n === 1 ? "" : "s"} overdue`, tone: "bad" };
  }
  if (days === 0) return { text: "Due today", tone: "warn" };
  if (days === 1) return { text: "Due tomorrow", tone: "warn" };
  return { text: `in ${days} days`, tone: "plain" };
}

function AttentionCard({
  items,
  currency,
  className = "",
}: {
  items: Attention[];
  currency: string;
  className?: string;
}) {
  return (
    <Card className={className} padded={false}>
      <CardHeader
        className="p-lg pb-md"
        title="Needs attention"
        subtitle="Overdue and due soon, across everything"
      />

      {items.length === 0 ? (
        <div className="px-lg pb-lg">
          <EmptyState
            size="sm"
            icon="check"
            title="Nothing overdue"
            description="Every follow-up, quote and invoice is inside its window."
          />
        </div>
      ) : (
        <ul>
          {items.map((item) => {
            const meta = ATTENTION_META[item.kind];
            const due = dueLabel(item.days);
            return (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  to={meta.href(item.id)}
                  className="flex items-center gap-md border-t border-line px-lg py-sm transition-colors duration-100 hover:bg-surface-hover"
                >
                  <span
                    className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md ${
                      due.tone === "bad"
                        ? "bg-bad-soft text-bad-fg"
                        : due.tone === "warn"
                          ? "bg-warn-soft text-warn-fg"
                          : "bg-surface-muted text-fg-muted"
                    }`}
                  >
                    <Icon name={meta.icon} size={14} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{item.label}</span>
                    {item.detail && (
                      <span className="block truncate text-xs text-fg-muted">{item.detail}</span>
                    )}
                  </span>

                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-xs font-medium ${
                        due.tone === "bad"
                          ? "text-bad-fg"
                          : due.tone === "warn"
                            ? "text-warn-fg"
                            : "text-fg-muted"
                      }`}
                    >
                      {due.text}
                    </span>
                    {item.amount > 0 && (
                      <span className="block text-xs tabular-nums text-fg-muted">
                        {formatMoneyCompact(item.amount, currency)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent activity                                                            */
/* -------------------------------------------------------------------------- */

function RecentCard({ items, className = "" }: { items: Recent[]; className?: string }) {
  return (
    <Card className={className} padded={false}>
      <CardHeader
        className="p-lg pb-md"
        title="Recent activity"
        subtitle="The last things that happened here"
      />

      {items.length === 0 ? (
        <div className="px-lg pb-lg">
          <EmptyState
            size="sm"
            icon="leads"
            title="Nothing logged yet"
            description="Calls, notes and stage changes will appear here as they happen."
          />
        </div>
      ) : (
        <ul>
          {items.map((item, i) => {
            const meta = KIND_META[item.kind as ActivityKind] ?? KIND_META.system;
            return (
              <li
                key={`${item.at}-${i}`}
                className="flex items-start gap-md border-t border-line px-lg py-sm"
              >
                <span className="mt-[2px] flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg-muted">
                  <Icon name={meta.icon} size={13} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">{item.subject}</span>
                  {item.body && (
                    <span className="block truncate text-xs text-fg-muted">{item.body}</span>
                  )}
                </span>

                <span className="shrink-0 whitespace-nowrap text-xs text-fg-subtle">
                  {relativeTime(item.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Pipelines                                                                  */
/* -------------------------------------------------------------------------- */

interface PipelineCardProps {
  currency: string;
  title: string;
  subtitle: string;
  to: string;
  pipeline: Pipeline;
  /** Stage → tone/bar map for whichever pipeline this is. */
  meta: Record<string, { tone: Tone; bar: string }>;
  label: (stage: string) => string;
  emptyIcon: "leads" | "deals";
  emptyText: string;
  className?: string;
}

/**
 * One pipeline breakdown. Shared by the deals and leads cards — the two boards
 * have different stages but an identical summary shape.
 */
function PipelineCard({
  currency,
  title,
  subtitle,
  to,
  pipeline,
  meta,
  label,
  emptyIcon,
  emptyText,
  className = "",
}: PipelineCardProps) {
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <Link
            to={to}
            className="shrink-0 text-xs font-medium text-accent transition-colors hover:text-accent-on"
          >
            Open →
          </Link>
        }
      />

      {pipeline.total > 0 ? (
        <Funnel pipeline={pipeline} meta={meta} label={label} currency={currency} />
      ) : (
        <div className="mt-lg">
          <EmptyState size="sm" icon={emptyIcon} title="Nothing here yet" description={emptyText} />
        </div>
      )}
    </Card>
  );
}

/**
 * Stacked bar + per-stage rows, in plain CSS.
 *
 * No charting library: recharts/chart.js would add 100–300 kB and a canvas or SVG
 * render pass for what two flex containers and a width percentage express exactly.
 */
function Funnel({
  pipeline,
  meta,
  label,
  currency,
}: Pick<PipelineCardProps, "meta" | "label" | "currency"> & { pipeline: Pipeline }) {
  const { stages, total, won } = pipeline;

  return (
    <>
      <div className="mt-lg flex h-[10px] gap-[2px] overflow-hidden rounded-full bg-surface-muted">
        {stages.map((s) =>
          s.count === 0 ? null : (
            <div
              key={s.stage}
              className={meta[s.stage]?.bar}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${label(s.stage)}: ${s.count}`}
            />
          ),
        )}
      </div>

      <ul className="mt-lg flex flex-col gap-sm">
        {stages.map((s) => {
          const share = total === 0 ? 0 : Math.round((s.count / total) * 100);
          return (
            <li key={s.stage} className="flex items-center gap-md text-xs">
              <span className="flex w-[92px] shrink-0 items-center gap-sm">
                <Dot tone={meta[s.stage]?.tone ?? "neutral"} />
                <span className="truncate font-medium text-fg-muted">{label(s.stage)}</span>
              </span>

              {/* Track + fill: one div each, no per-bar component. */}
              <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-surface-muted">
                <span
                  className={`block h-full rounded-full ${meta[s.stage]?.bar ?? ""}`}
                  style={{ width: `${share}%` }}
                />
              </span>

              <span className="w-[84px] shrink-0 text-right tabular-nums text-fg-muted">
                {s.count} · {formatMoneyCompact(s.value, currency)}
              </span>
            </li>
          );
        })}
      </ul>

      {won > 0 && (
        <p className="mt-md border-t border-line pt-md text-xs text-fg-muted">
          Won so far: <span className="font-semibold text-fg">{formatMoney(won, currency)}</span>
        </p>
      )}
    </>
  );
}

/** Matches the loaded layout's shape, so the page doesn't jump when data lands. */
function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] w-full" />
        ))}
      </div>
      <div className="grid gap-md lg:grid-cols-12">
        <Skeleton className="h-[280px] w-full lg:col-span-7" />
        <Skeleton className="h-[280px] w-full lg:col-span-5" />
      </div>
    </>
  );
}

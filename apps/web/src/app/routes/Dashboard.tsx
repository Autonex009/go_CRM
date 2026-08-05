import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../auth/store";
import { STAGE_META as DEAL_META, stageLabel as dealStageLabel } from "../deals/stages";
import { STAGE_META as LEAD_META, stageLabel as leadStageLabel } from "../leads/stages";
import { ApiError } from "../lib/api";
import { dashboardApi, type Pipeline } from "../lib/dashboard";
import { formatMoney, formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import {
  Alert,
  Card,
  CardHeader,
  Dot,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
  StatTile,
  buttonClass,
  type Tone,
} from "../ui";

/**
 * Portal landing page. One request to /api/v1/dashboard rather than fanning out
 * to every module, so the numbers are consistent with each other.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const currency = useCurrency();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.summary,
    // Counts don't need to be to-the-second; avoids a refetch every time the
    // user tabs back to the dashboard.
    staleTime: 30_000,
  });
  const data = query.data;

  const firstName = user?.name?.trim().split(" ")[0] ?? user?.email?.split("@")[0];

  const winRate = useMemo(() => {
    if (!data || data.deals.total === 0) return undefined;
    const won = data.deals.stages.find((s) => s.stage === "won")?.count ?? 0;
    return `${Math.round((won / data.deals.total) * 100)}% won`;
  }, [data]);

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        subtitle="Your pipeline at a glance."
        action={
          <Link to="/deals" className={buttonClass({ variant: "secondary" })}>
            <Icon name="deals" size={16} />
            Open deals
          </Link>
        }
      />

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load the dashboard"}
        </Alert>
      )}

      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          accent
          label="Open deals"
          icon="trend"
          value={data ? formatMoney(data.deals.open, currency) : undefined}
          hint={winRate ?? "Not yet won or lost"}
          to="/deals"
        />
        <StatTile
          label="Lead pipeline"
          icon="leads"
          value={data ? formatMoney(data.leads.open, currency) : undefined}
          hint={data ? `${data.leads.total} leads` : undefined}
          to="/leads"
        />
        <StatTile
          label="Contacts"
          icon="contacts"
          value={data ? String(data.contacts) : undefined}
          to="/contacts"
        />
        <StatTile
          label="Team"
          icon="team"
          value={data ? String(data.members) : undefined}
          to="/team"
        />
      </div>

      <div className="grid gap-md lg:grid-cols-2">
        <PipelineCard
          currency={currency}
          title="Deals by stage"
          subtitle="Where revenue is sitting"
          to="/deals"
          pipeline={data?.deals}
          loading={query.isPending}
          meta={DEAL_META}
          label={dealStageLabel}
          emptyIcon="deals"
          emptyText="No deals yet. Create one to start tracking revenue."
        />
        <PipelineCard
          currency={currency}
          title="Leads by stage"
          subtitle="Share of leads in each stage"
          to="/leads"
          pipeline={data?.leads}
          loading={query.isPending}
          meta={LEAD_META}
          label={leadStageLabel}
          emptyIcon="leads"
          emptyText="No leads yet. Add your first one to start tracking the pipeline."
        />
      </div>
    </section>
  );
}

interface PipelineCardProps {
  currency: string;
  title: string;
  subtitle: string;
  to: string;
  pipeline?: Pipeline;
  loading: boolean;
  /** Stage → tone/bar map for whichever pipeline this is. */
  meta: Record<string, { tone: Tone; bar: string }>;
  label: (stage: string) => string;
  emptyIcon: "leads" | "deals";
  emptyText: string;
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
  loading,
  meta,
  label,
  emptyIcon,
  emptyText,
}: PipelineCardProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <Link
            to={to}
            className="text-xs font-medium text-accent transition-colors hover:text-accent-on"
          >
            Open board →
          </Link>
        }
      />

      {loading ? (
        <div className="mt-lg flex flex-col gap-sm">
          <Skeleton className="h-[10px] w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[18px] w-full" />
          ))}
        </div>
      ) : pipeline && pipeline.total > 0 ? (
        <Funnel pipeline={pipeline} meta={meta} label={label} currency={currency} />
      ) : (
        <div className="mt-lg">
          <EmptyState icon={emptyIcon} title="Nothing here yet" description={emptyText} />
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

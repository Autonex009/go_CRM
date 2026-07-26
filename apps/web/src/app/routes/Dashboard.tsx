import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "../auth/store";
import { STAGE_META, formatCompact, formatValue, stageLabel } from "../leads/stages";
import { ApiError } from "../lib/api";
import { dashboardApi, type StageSummary } from "../lib/dashboard";
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
} from "../ui";

/**
 * Portal landing page. One request to /api/v1/dashboard rather than fanning out
 * to every module, so the numbers are consistent with each other.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.summary,
    // Counts don't need to be to-the-second; this avoids a refetch every time
    // the user tabs back to the dashboard.
    staleTime: 30_000,
  });
  const data = query.data;

  const firstName = user?.name?.trim().split(" ")[0] ?? user?.email?.split("@")[0];

  const conversion = useMemo(() => {
    if (!data || data.leads === 0) return undefined;
    const won = data.stages.find((s) => s.stage === "won")?.count ?? 0;
    return `${Math.round((won / data.leads) * 100)}%`;
  }, [data]);

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        subtitle="Your pipeline at a glance."
        action={
          <Link to="/leads" className={buttonClass({ variant: "secondary" })}>
            <Icon name="leads" size={16} />
            Open board
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
          label="Open pipeline"
          icon="trend"
          value={data ? formatValue(data.openPipeline) : undefined}
          hint="Not yet won or lost"
          to="/leads"
        />
        <StatTile
          label="Leads"
          icon="leads"
          value={data ? String(data.leads) : undefined}
          hint={conversion ? `${conversion} won` : undefined}
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

      <div className="grid gap-md lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Pipeline by stage"
            subtitle="Share of leads currently sitting in each stage"
            action={
              <Link
                to="/leads"
                className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
              >
                Open board →
              </Link>
            }
          />

          {query.isPending ? (
            <div className="mt-lg flex flex-col gap-sm">
              <Skeleton className="h-[10px] w-full" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[18px] w-full" />
              ))}
            </div>
          ) : data && data.leads > 0 ? (
            <Funnel stages={data.stages} total={data.leads} />
          ) : (
            <div className="mt-lg">
              <EmptyState
                icon="leads"
                title="No leads yet"
                description="Add your first lead to start tracking the pipeline."
                action={
                  <Link to="/leads">
                    <span className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Go to the board →
                    </span>
                  </Link>
                }
              />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Won" subtitle="Closed value so far" />
          <p className="mt-lg text-2xl font-semibold tabular-nums tracking-[-0.02em] text-neutral-900">
            {data ? formatValue(data.wonValue) : "—"}
          </p>
          {data && (
            <dl className="mt-lg flex flex-col gap-sm border-t border-neutral-200 pt-md text-xs">
              {(["won", "lost"] as const).map((stage) => {
                const row = data.stages.find((s) => s.stage === stage);
                return (
                  <div key={stage} className="flex items-center gap-sm">
                    <Dot tone={STAGE_META[stage].tone} />
                    <dt className="text-neutral-600">{stageLabel(stage)}</dt>
                    <dd className="ml-auto tabular-nums text-neutral-500">
                      {row?.count ?? 0} · {formatCompact(row?.value ?? 0)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </Card>
      </div>
    </section>
  );
}

/**
 * Stacked bar + per-stage rows, in plain CSS.
 *
 * No charting library: recharts/chart.js would add 100–300 kB and a canvas or SVG
 * render pass for what two flex containers and a width percentage express exactly.
 */
function Funnel({ stages, total }: { stages: StageSummary[]; total: number }) {
  return (
    <>
      <div className="mt-lg flex h-[10px] gap-[2px] overflow-hidden rounded-full bg-neutral-100">
        {stages.map((s) =>
          s.count === 0 ? null : (
            <div
              key={s.stage}
              className={STAGE_META[s.stage].bar}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${stageLabel(s.stage)}: ${s.count}`}
            />
          ),
        )}
      </div>

      <ul className="mt-lg flex flex-col gap-sm">
        {stages.map((s) => {
          const share = total === 0 ? 0 : Math.round((s.count / total) * 100);
          return (
            <li key={s.stage} className="flex items-center gap-md text-xs">
              <span className="flex w-[104px] shrink-0 items-center gap-sm">
                <Dot tone={STAGE_META[s.stage].tone} />
                <span className="font-medium text-neutral-700">{stageLabel(s.stage)}</span>
              </span>

              {/* Track + fill: one div each, no per-bar component. */}
              <span className="h-[6px] flex-1 overflow-hidden rounded-full bg-neutral-100">
                <span
                  className={`block h-full rounded-full ${STAGE_META[s.stage].bar}`}
                  style={{ width: `${share}%` }}
                />
              </span>

              <span className="w-[88px] shrink-0 text-right tabular-nums text-neutral-500">
                {s.count} · {formatCompact(s.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

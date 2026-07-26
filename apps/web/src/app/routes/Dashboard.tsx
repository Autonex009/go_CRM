import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useAuthStore } from "../auth/store";
import { Alert } from "../components/AuthLayout";
import { STAGE_META, formatValue, stageLabel } from "../leads/stages";
import { ApiError } from "../lib/api";
import { dashboardApi, type StageSummary } from "../lib/dashboard";

/**
 * Portal landing page. One request to /api/v1/dashboard rather than fanning out
 * to every module, so the numbers are consistent with each other.
 */
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const query = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const data = query.data;

  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0];

  return (
    <section className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">
          {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        </h1>
        <p className="mt-xs text-sm text-neutral-500">Your workspace at a glance.</p>
      </header>

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load the dashboard"}
        </Alert>
      )}

      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open pipeline"
          value={data ? formatValue(data.openPipeline) : "—"}
          hint="Not yet won or lost"
          to="/leads"
        />
        <Stat label="Leads" value={data ? String(data.leads) : "—"} to="/leads" />
        <Stat label="Contacts" value={data ? String(data.contacts) : "—"} to="/contacts" />
        <Stat label="Team" value={data ? String(data.members) : "—"} to="/team" />
      </div>

      <div className="rounded-lg border border-neutral-900/10 bg-white p-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Pipeline by stage</h2>
          <Link to="/leads" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Open board →
          </Link>
        </div>

        {query.isPending ? (
          <p className="mt-md text-sm text-neutral-500">Loading…</p>
        ) : data && data.leads > 0 ? (
          <StageBreakdown stages={data.stages} total={data.leads} wonValue={data.wonValue} />
        ) : (
          <p className="mt-md text-sm text-neutral-500">
            No leads yet.{" "}
            <Link to="/leads" className="font-medium text-brand-600 hover:text-brand-700">
              Add your first one
            </Link>{" "}
            to start tracking the pipeline.
          </p>
        )}
      </div>
    </section>
  );
}

function StageBreakdown({
  stages,
  total,
  wonValue,
}: {
  stages: StageSummary[];
  total: number;
  wonValue: number;
}) {
  return (
    <>
      {/* Single stacked bar: proportion of the pipeline sitting in each stage. */}
      <div className="mt-md flex h-[8px] gap-[2px] overflow-hidden rounded-full">
        {stages.map((s) =>
          s.count === 0 ? null : (
            <div
              key={s.stage}
              className={STAGE_META[s.stage].dot}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${stageLabel(s.stage)}: ${s.count}`}
            />
          ),
        )}
      </div>

      <ul className="mt-md grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((s) => (
          <li key={s.stage} className="flex items-center gap-sm text-sm">
            <span className={`h-[6px] w-[6px] rounded-full ${STAGE_META[s.stage].dot}`} />
            <span className="text-neutral-900">{stageLabel(s.stage)}</span>
            <span className="ml-auto tabular-nums text-neutral-500">
              {s.count}
              {s.value > 0 && ` · ${formatValue(s.value)}`}
            </span>
          </li>
        ))}
      </ul>

      {wonValue > 0 && (
        <p className="mt-md border-t border-neutral-900/10 pt-md text-sm text-neutral-500">
          Won so far:{" "}
          <span className="font-semibold text-neutral-900">{formatValue(wonValue)}</span>
        </p>
      )}
    </>
  );
}

interface StatProps {
  label: string;
  value: string;
  to?: string;
  hint?: string;
}

function Stat({ label, value, to, hint }: StatProps) {
  const body = (
    <>
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className="mt-xs text-xl font-bold tabular-nums text-neutral-900">{value}</p>
      {hint && <p className="mt-xs text-xs text-neutral-500">{hint}</p>}
    </>
  );

  const className = "rounded-lg border border-neutral-900/10 bg-white p-lg";
  if (!to) return <div className={className}>{body}</div>;
  return (
    <Link to={to} className={`${className} block transition hover:border-brand-500`}>
      {body}
    </Link>
  );
}

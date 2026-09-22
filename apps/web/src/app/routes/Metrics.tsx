import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { MANAGER_ROLES } from "../auth/roles";
import { useAuthStore } from "../auth/store";
import { ApiError } from "../lib/api";
import { formatMoney, formatMoneyCompact } from "../lib/money";
import {
  PRICED_THRESHOLD,
  RANGES,
  metricsApi,
  pricedShare,
  rangeBounds,
  type RangeKey,
} from "../metrics/api";
import { Funnel } from "../metrics/Funnel";
import { Leaderboard } from "../metrics/Leaderboard";
import { StalledDeals } from "../metrics/StalledDeals";
import { Trend } from "../metrics/Trend";
import { memberLabel, orgApi } from "../org/api";
import { useCurrency } from "../org/workspace";
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SelectField,
  Skeleton,
} from "../ui";

export default function Metrics() {
  const currency = useCurrency();
  // A rep's report is pinned to their own deals by the gateway, whatever this
  // page asks for. Offering them an owner picker would quietly relabel their
  // own numbers as somebody else's, so the filter is a manager's control only.
  const role = useAuthStore((s) => s.user?.role);
  const canPickOwner = !!role && MANAGER_ROLES.includes(role);
  const [range, setRange] = useState<RangeKey>(0);
  const [ownerId, setOwnerId] = useState("");

  const filter = useMemo(
    () => ({ ...rangeBounds(range), ...(ownerId ? { ownerId } : {}) }),
    [range, ownerId],
  );

  const query = useQuery({
    queryKey: ["metrics", filter],
    queryFn: () => metricsApi.report(filter),
    staleTime: 60_000,
  });

  // Already cached by Actions and the deal dialog — reusing the key means this
  // page adds no extra request on a repeat visit.
  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
    enabled: canPickOwner,
  });

  const data = query.data;

  // Below the threshold the money figures are hidden rather than shown as a
  // confident zero: most deals here were filed without an amount, and a ₹0
  // funnel reads as "we have quoted nothing" rather than "nobody typed it in".
  const priced = data ? pricedShare(data.coverage) : 1;
  const showValue = priced >= PRICED_THRESHOLD;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Sales analytics"
        subtitle="Pipeline value, camera volume and where deals are getting stuck."
        action={
          <div className="flex flex-wrap items-end gap-sm">
            <SelectField
              label="Period"
              value={String(range)}
              onChange={(e) => setRange(Number(e.target.value) as RangeKey)}
            >
              {RANGES.map(({ days, label }) => (
                <option key={days} value={days}>
                  {label}
                </option>
              ))}
            </SelectField>

            {canPickOwner && (
              <SelectField
                label="Owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">Whole team</option>
                {(members.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {memberLabel(m)}
                  </option>
                ))}
              </SelectField>
            )}
          </div>
        }
      />

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError
            ? query.error.message
            : "Could not load the analytics"}
        </Alert>
      )}

      {query.isPending ? (
        <MetricsSkeleton />
      ) : !data || data.totals.deals === 0 ? (
        <EmptyState
          icon="trend"
          title="No deals in this period"
          description={
            canPickOwner
              ? "Widen the period, or clear the owner filter."
              : "Widen the period to see more of your pipeline."
          }
        />
      ) : (
        <>
          {!showValue && (
            <Alert tone="warning">
              Only {data.coverage.priced} of {data.coverage.deals} deals have a
              value on them, so money figures are hidden. Camera counts cover{" "}
              {data.coverage.withCameras} of {data.coverage.deals}. Add amounts
              to the rest to unlock the money columns.
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
            <Tile
              label="Cameras in pipeline"
              value={String(data.totals.openCameras)}
              hint={`${data.totals.wonCameras} won · ${data.totals.totalCameras} all time`}
            />
            <Tile
              label="Out on quotation"
              value={
                showValue ? formatMoney(data.totals.quotedValue, currency) : "—"
              }
              hint={`${stageCount(data.stages, "quote_sent")} deals quoted`}
              muted={!showValue}
            />
            <Tile
              label="Won"
              value={showValue ? formatMoney(data.totals.wonValue, currency) : "—"}
              hint={`${data.totals.wonCount} of ${data.totals.deals} deals · ${Math.round(data.totals.conversionRate)}% closed`}
              muted={!showValue}
            />
            <Tile
              label="Average deal"
              value={
                showValue ? formatMoneyCompact(data.totals.avgDealSize, currency) : "—"
              }
              hint={
                data.totals.valuePerCamera > 0
                  ? `${formatMoneyCompact(data.totals.valuePerCamera, currency)} per camera`
                  : "No won cameras yet"
              }
              muted={!showValue}
            />
          </div>

          <Card className="flex flex-col gap-md">
            <CardHeader
              title="Pipeline by stage"
              subtitle="Bar length is the number of deals; the columns are value and cameras."
            />
            <Funnel stages={data.stages} currency={currency} showValue={showValue} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card className="flex flex-col gap-md">
              <CardHeader
                title="Needs attention"
                subtitle="Open deals with no movement in two weeks, most valuable first."
              />
              <StalledDeals
                rows={data.stalled}
                currency={currency}
                showValue={showValue}
              />
            </Card>

            <Card className="flex flex-col gap-md">
              <CardHeader title="By owner" subtitle="Ranked by what has closed." />
              <Leaderboard
                owners={data.owners}
                currency={currency}
                showValue={showValue}
              />
            </Card>
          </div>

          {data.months.length > 0 && (
            <Card className="flex flex-col gap-md">
              <CardHeader
                title="Deals opened"
                subtitle={
                  data.months.length > 1
                    ? "Per month, with the won share filled in."
                    : "Per month, with the won share filled in. Only one month falls in this period — widen it to see a trend."
                }
              />
              <Trend months={data.months} />
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
  muted = false,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-xs">
      <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <span
        className={`text-2xl font-semibold tabular-nums ${muted ? "text-fg-muted" : "text-fg"}`}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-fg-muted">{hint}</span>}
    </Card>
  );
}

function stageCount(stages: { stage: string; count: number }[], stage: string): number {
  return stages.find((s) => s.stage === stage)?.count ?? 0;
}

function MetricsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full" />
        ))}
      </div>
      <Skeleton className="h-[320px] w-full" />
    </div>
  );
}

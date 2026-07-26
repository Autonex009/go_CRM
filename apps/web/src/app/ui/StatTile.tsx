import { memo } from "react";
import { Link } from "react-router-dom";

import { Icon, type IconName } from "./Icon";
import { Skeleton } from "./primitives";

interface StatTileProps {
  label: string;
  /** Formatted display value. `undefined` renders the skeleton. */
  value?: string;
  icon: IconName;
  hint?: string;
  to?: string;
  /** Emphasised tile — used for the headline metric. */
  accent?: boolean;
}

/**
 * KPI tile. One component for every metric on the dashboard, so a new number is
 * a prop rather than another bespoke card.
 */
export const StatTile = memo(function StatTile({
  label,
  value,
  icon,
  hint,
  to,
  accent = false,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </span>
        <span
          className={`flex h-[28px] w-[28px] items-center justify-center rounded-md ${
            accent ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          <Icon name={icon} size={15} />
        </span>
      </div>

      {value === undefined ? (
        <Skeleton className="mt-md h-[28px] w-[72px]" />
      ) : (
        <p
          className={`mt-md text-2xl font-semibold tabular-nums tracking-[-0.02em] ${
            accent ? "text-white" : "text-neutral-900"
          }`}
        >
          {value}
        </p>
      )}

      {hint && (
        <p className={`mt-xs text-xs ${accent ? "text-brand-100" : "text-neutral-500"}`}>{hint}</p>
      )}
    </>
  );

  const surface = accent
    ? "bg-brand-600 border-brand-600 text-white shadow-md"
    : "bg-white border-neutral-200 shadow-sm";
  const className = `rounded-lg border p-lg transition-shadow duration-100 ${surface}`;

  if (!to) return <div className={className}>{body}</div>;
  return (
    <Link to={to} className={`${className} block hover:shadow-md`}>
      {body}
    </Link>
  );
});

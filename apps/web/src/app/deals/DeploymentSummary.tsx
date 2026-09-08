import { Icon } from "../ui";

export interface Deployment {
  totalCameras?: number | null;
  location?: string | null;
  products?: string | null;
}

interface DeploymentSummaryProps extends Deployment {
  /** Tighter type and no labels, for the dense preview cards. */
  compact?: boolean;
}

/**
 * What a deal is actually deploying: products, sites, camera count.
 *
 * Shared between the deal form's siblings and both places the company profile
 * lists deals, so the three fields are always shown the same way and adding a
 * fourth is one edit rather than three.
 *
 * Renders nothing when a deal has none of them — an empty row of dashes on
 * every unscoped deal is noise, and most deals are unscoped early on.
 */
export function DeploymentSummary({
  totalCameras,
  location,
  products,
  compact = false,
}: DeploymentSummaryProps) {
  const hasCameras = typeof totalCameras === "number";
  if (!hasCameras && !location?.trim() && !products?.trim()) return null;

  const items: {
    icon: "monitor" | "building" | "deals";
    label: string;
    value: string;
  }[] = [];
  if (products?.trim())
    items.push({ icon: "deals", label: "Products", value: products.trim() });
  if (location?.trim())
    items.push({ icon: "building", label: "Location", value: location.trim() });
  if (hasCameras) {
    items.push({
      icon: "monitor",
      label: "Cameras",
      value: `${totalCameras!.toLocaleString()} camera${totalCameras === 1 ? "" : "s"}`,
    });
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-sm gap-y-xs text-[11px] text-fg-subtle">
        {items.map((item) => (
          <span
            key={item.label}
            className="flex min-w-0 items-center gap-[3px]"
          >
            <Icon name={item.icon} size={11} className="shrink-0" />
            <span className="truncate">{item.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <dl className="mt-xs grid grid-cols-1 gap-xs rounded-md border border-line/60 bg-surface/80 p-sm sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col">
          <dt className="flex items-center gap-[3px] text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
            <Icon name={item.icon} size={11} />
            {item.label}
          </dt>
          <dd className="mt-0.5 truncate text-xs text-fg" title={item.value}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

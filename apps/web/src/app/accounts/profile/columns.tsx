import { Badge } from "../../ui";
import { getStageMeta, stageLabel } from "../../deals/stages";
import { formatMoney } from "../../lib/money";
import type {
  LinkedContact,
  LinkedDeal,
  LinkedInvoice,
  LinkedLead,
  LinkedQuote,
} from "../api";
import { daysFromToday, formatDay } from "./format";
import type { RecordColumn } from "./RecordTable";

/**
 * Column definitions for the profile's tables, in one place.
 *
 * The Overview shows a shortened deal table and the Pipeline tab the full one.
 * Defining the columns once and slicing them keeps the two from drifting into
 * showing the same deal differently.
 */
export function dealColumns(currency: string): RecordColumn<LinkedDeal>[] {
  return [
    {
      key: "title",
      header: "Deal",
      cell: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg" title={d.title}>
            {d.title}
          </div>
          {d.remark?.trim() && (
            <div
              className="mt-0.5 line-clamp-1 text-xs italic text-fg-subtle"
              title={d.remark}
            >
              {d.remark.trim()}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      cell: (d) => (
        <Badge tone={getStageMeta(d.stage).tone} dot>
          {stageLabel(d.stage)}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Value",
      align: "right",
      cell: (d) => (
        <span className="font-semibold text-fg">
          {formatMoney(d.amount, currency)}
        </span>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      align: "right",
      secondary: true,
      cell: (d) =>
        typeof d.probability === "number" ? (
          <span className="text-xs text-fg-muted">{d.probability}%</span>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        ),
    },
    {
      key: "scope",
      header: "Scope",
      secondary: true,
      cell: (d) => <Scope deal={d} />,
    },
    {
      key: "close",
      header: "Target close",
      align: "right",
      secondary: true,
      cell: (d) => <DueDate iso={d.expectedCloseDate} dealStage={d.stage} />,
    },
  ];
}

/** The Overview's shortened deal table: identity, stage, value, close date. */
export function compactDealColumns(
  currency: string,
): RecordColumn<LinkedDeal>[] {
  return dealColumns(currency).filter(
    (c) => c.key !== "scope" && c.key !== "confidence",
  );
}

export function leadColumns(currency: string): RecordColumn<LinkedLead>[] {
  return [
    {
      key: "name",
      header: "Lead",
      cell: (l) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">
            {[l.firstName, l.lastName].filter(Boolean).join(" ") || "Unnamed"}
          </div>
          {l.title && (
            <div className="truncate text-xs text-fg-subtle" title={l.title}>
              {l.title}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      cell: (l) => <Badge tone="brand">{humanise(l.stage)}</Badge>,
    },
    {
      key: "contact",
      header: "Contact",
      secondary: true,
      cell: (l) => (
        <div className="min-w-0 text-xs">
          {l.email ? (
            <a
              href={`mailto:${l.email}`}
              className="block truncate text-accent hover:underline"
              title={l.email}
            >
              {l.email}
            </a>
          ) : (
            <span className="text-fg-subtle">No email</span>
          )}
          {l.phone && (
            <span className="block truncate text-fg-muted">{l.phone}</span>
          )}
        </div>
      ),
    },
    {
      key: "value",
      header: "Estimate",
      align: "right",
      cell: (l) => (
        <span className={l.value ? "font-semibold text-fg" : "text-fg-subtle"}>
          {l.value ? formatMoney(l.value, currency) : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Added",
      align: "right",
      secondary: true,
      cell: (l) => (
        <span className="text-xs text-fg-muted">{formatDay(l.createdAt)}</span>
      ),
    },
  ];
}

export function quoteColumns(currency: string): RecordColumn<LinkedQuote>[] {
  return [
    {
      key: "number",
      header: "Quote",
      cell: (q) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">
            {q.number || "Untitled quote"}
          </div>
          <div className="text-xs text-fg-subtle">
            v{q.currentVersion} · raised {formatDay(q.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (q) => <Badge tone={docTone(q.status)}>{humanise(q.status)}</Badge>,
    },
    {
      key: "valid",
      header: "Valid until",
      align: "right",
      secondary: true,
      cell: (q) => <DueDate iso={q.validUntil} />,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (q) => (
        <span className="font-semibold text-fg">
          {formatMoney(q.total, q.currency || currency)}
        </span>
      ),
    },
  ];
}

export function invoiceColumns(
  currency: string,
): RecordColumn<LinkedInvoice>[] {
  return [
    {
      key: "number",
      header: "Invoice",
      cell: (i) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">
            {i.invoiceNumber || i.title || "Untitled invoice"}
          </div>
          <div className="text-xs text-fg-subtle">
            raised {formatDay(i.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (i) => <Badge tone={docTone(i.status)}>{humanise(i.status)}</Badge>,
    },
    {
      key: "due",
      header: "Due",
      align: "right",
      secondary: true,
      cell: (i) => <DueDate iso={i.dueDate} settled={i.amountDue <= 0} />,
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      secondary: true,
      cell: (i) => (
        <span className="text-fg-muted">
          {formatMoney(i.amountPaid, currency)}
        </span>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      cell: (i) => (
        <span
          className={
            i.amountDue > 0 ? "font-semibold text-warn-fg" : "text-fg-subtle"
          }
        >
          {i.amountDue > 0 ? formatMoney(i.amountDue, currency) : "Settled"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (i) => (
        <span className="font-semibold text-fg">
          {formatMoney(i.total, currency)}
        </span>
      ),
    },
  ];
}

export function contactColumns(): RecordColumn<LinkedContact>[] {
  return [
    {
      key: "name",
      header: "Contact",
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">
            {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed"}
          </div>
          {c.title && (
            <div className="truncate text-xs text-fg-subtle">{c.title}</div>
          )}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (c) =>
        c.email ? (
          <a
            href={`mailto:${c.email}`}
            className="block truncate text-xs text-accent hover:underline"
            title={c.email}
          >
            {c.email}
          </a>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      align: "right",
      secondary: true,
      cell: (c) => (
        <span className="text-xs text-fg-muted">{c.phone || "—"}</span>
      ),
    },
  ];
}

/** Cameras, site and products for one deal, stacked into a single cell. */
function Scope({ deal }: { deal: LinkedDeal }) {
  const detail = [deal.location?.trim(), deal.products?.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0 text-xs text-fg-muted">
      <div className="truncate">
        {typeof deal.totalCameras === "number"
          ? `${deal.totalCameras.toLocaleString()} camera${deal.totalCameras === 1 ? "" : "s"}`
          : "Not scoped"}
      </div>
      {detail && (
        <div className="truncate text-fg-subtle" title={detail}>
          {detail}
        </div>
      )}
    </div>
  );
}

/**
 * A date with the overdue case called out.
 *
 * A won deal closing in the past is not a problem, and neither is a settled
 * invoice's due date, so both suppress the warning.
 */
function DueDate({
  iso,
  dealStage,
  settled = false,
}: {
  iso: string | null;
  /** Set when the date belongs to a deal, so a won deal stops being "late". */
  dealStage?: string;
  settled?: boolean;
}) {
  if (!iso) return <span className="text-xs text-fg-subtle">—</span>;

  const days = daysFromToday(iso);
  const overdue =
    days !== null && days < 0 && dealStage !== "won" && !settled;

  return (
    <span
      className={`text-xs ${overdue ? "font-semibold text-bad-fg" : "text-fg-muted"}`}
      title={overdue ? `${Math.abs(days)} days overdue` : undefined}
    >
      {formatDay(iso)}
      {overdue && (
        <span className="ml-1 font-normal">({Math.abs(days)}d late)</span>
      )}
    </span>
  );
}

/** "pending_renewal" -> "Pending renewal". Statuses arrive as DB enums. */
export function humanise(raw: string): string {
  const s = raw.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : "—";
}

/** Quote and invoice statuses share a vocabulary close enough to share tones. */
function docTone(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
    case "accepted":
    case "approved":
      return "success" as const;
    case "sent":
    case "issued":
    case "partial":
      return "info" as const;
    case "overdue":
    case "rejected":
    case "declined":
    case "void":
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

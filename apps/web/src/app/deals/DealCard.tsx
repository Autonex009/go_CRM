import { memo } from "react";
import { User, Calendar, Building2, AlertTriangle } from "lucide-react";

import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { Avatar } from "../ui";
import type { Deal } from "./api";
import { daysUntil, formatDate, isClosed } from "./stages";

interface DealCardProps {
  deal: Deal;
  overlay?: boolean;
}

export const DealCard = memo(function DealCard({ deal, overlay = false }: DealCardProps) {
  const currency = useCurrency();
  const owner = deal.ownerName?.trim() || deal.ownerEmail;
  const days = isClosed(deal.stage) ? null : daysUntil(deal.expectedCloseDate);

  return (
    <article
      className={`relative rounded-2xl border p-4 transition-all duration-200 ${
        overlay
          ? "rotate-2 border-indigo-500/60 bg-surface/90 backdrop-blur-md shadow-2xl scale-105"
          : "border-line bg-surface/80 hover:border-indigo-500/40 hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-bold leading-snug text-fg line-clamp-2">{deal.title}</h4>
        <span className="shrink-0 rounded-xl bg-indigo-500/10 px-2.5 py-1 text-xs font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          {formatMoneyCompact(deal.amount, currency)}
        </span>
      </div>

      {deal.contactName && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
          <User className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="truncate font-medium">{deal.contactName}</span>
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
        {owner ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={owner} title={deal.ownerEmail ?? owner} size="xs" />
            <span className="text-[11px] font-medium text-fg-muted truncate max-w-24">{owner}</span>
          </div>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">Unassigned</span>
        )}

        {deal.expectedCloseDate &&
          (days !== null && days < 0 ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-500 border border-rose-500/20">
              <AlertTriangle className="h-3 w-3" />
              {Math.abs(days)}d overdue
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-muted">
              <Calendar className="h-3 w-3 text-fg-subtle" />
              {formatDate(deal.expectedCloseDate)}
            </span>
          ))}
      </div>
    </article>
  );
});


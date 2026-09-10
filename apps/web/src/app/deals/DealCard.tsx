import { memo } from "react";
import {
  Calendar,
  AlertTriangle,
  MessageSquare,
  Camera,
  MapPin,
  User,
  Layers,
  FileText,
} from "lucide-react";

import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { Avatar } from "../ui";
import type { Deal } from "./api";
import { daysUntil, formatDate, isClosed } from "./stages";

interface DealCardProps {
  deal: Deal;
  overlay?: boolean;
  onRemark?: (deal: Deal) => void;
  onGenerateQuote?: (deal: Deal) => void;
}

/**
 * Extracts cameras, location, and lead name from structured deal columns,
 * with fallback to parsing legacy unstructured remarks.
 */
function parseDealCardInfo(deal: Deal) {
  let remark = deal.remark?.trim() || deal.description?.trim() || "";
  // Sanitize any Kedar Sathe references from remark text
  if (remark && /kedar\s*sathe/i.test(remark)) {
    remark = remark.replace(/kedar\s*sathe/gi, "").trim();
  }

  // 1. Number of cameras
  let cameras = deal.totalCameras ?? null;
  if (cameras === null && remark) {
    const camMatch = remark.match(
      /(?:number\s+of\s+cameras?|no\.?\s+of\s+cameras?|cams?)\s*[:\-]?\s*(\d+)/i,
    );
    if (camMatch) {
      cameras = parseInt(camMatch[1], 10);
    }
  }

  // 2. Location
  let location = deal.location?.trim() || null;
  if (!location && remark) {
    const locMatch = remark.match(
      /location\s*[:\-]\s*([^,\n\-;]+(?:,\s*[^,\n\-;]+)?)/i,
    );
    if (locMatch) {
      location = locMatch[1].trim();
    }
  }

  // 3. Lead name (from linked lead or extracted from remark, never contactName or Kedar Sathe)
  let leadName = deal.leadName?.trim() || null;
  if (!leadName && remark) {
    const leadMatch = remark.match(
      /^([A-Za-z0-9\s().&'/-]+?)\s+(?:Number\s+of|no\.?\s+of|cams?)/i,
    );
    if (leadMatch) {
      const candidate = leadMatch[1].trim();
      if (candidate && !/^(call|deal|note|meeting|demo)/i.test(candidate)) {
        leadName = candidate;
      }
    }
  }
  if (leadName && /kedar\s*sathe/i.test(leadName)) {
    leadName = null;
  }

  // 4. Products
  const products = deal.products?.trim() || null;

  return { cameras, location, leadName, products, cleanRemark: remark };
}

export const DealCard = memo(function DealCard({
  deal,
  overlay = false,
  onRemark,
  onGenerateQuote,
}: DealCardProps) {
  const currency = useCurrency();
  const rawOwner = deal.ownerName?.trim() || deal.ownerEmail;
  const owner = /kedar\s*sathe/i.test(rawOwner || "") ? null : rawOwner;
  const days = isClosed(deal.stage) ? null : daysUntil(deal.expectedCloseDate);

  const { cameras, location, leadName, products, cleanRemark } =
    parseDealCardInfo(deal);
  const remarkText = cleanRemark;

  return (
    <article
      className={`relative rounded-2xl border p-4 transition-all duration-200 ${
        overlay
          ? "rotate-2 border-indigo-500/60 bg-surface/90 backdrop-blur-md shadow-2xl scale-105"
          : "border-line bg-surface/80 hover:border-indigo-500/40 hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      {/* Title & Amount */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-bold leading-snug text-fg line-clamp-2">
          {deal.title}
        </h4>
        <span className="shrink-0 rounded-xl bg-indigo-500/10 px-2.5 py-1 text-xs font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          {formatMoneyCompact(deal.amount, currency)}
        </span>
      </div>

      {/* Lead Name */}
      {leadName && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-muted font-medium">
          <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="truncate" title={`Lead: ${leadName}`}>
            {leadName}
          </span>
        </div>
      )}

      {/* Structured Info Badges: Cameras, Location, Products */}
      {(cameras !== null || location || products) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {cameras !== null && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400 border border-sky-500/20"
              title={`${cameras} ${cameras === 1 ? "camera" : "cameras"}`}
            >
              <Camera className="h-3 w-3 shrink-0" />
              <span>
                {cameras} {cameras === 1 ? "cam" : "cams"}
              </span>
            </span>
          )}

          {location && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20 max-w-[150px] truncate"
              title={`Location: ${location}`}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}

          {products && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20 max-w-[140px] truncate"
              title={`Products: ${products}`}
            >
              <Layers className="h-3 w-3 shrink-0" />
              <span className="truncate">{products}</span>
            </span>
          )}
        </div>
      )}

      {/* Remark / Notes bubble */}
      {remarkText && (
        <div
          onClick={(e) => {
            if (onRemark) {
              e.stopPropagation();
              onRemark(deal);
            }
          }}
          className="mt-2.5 flex items-start gap-1.5 text-xs text-fg-subtle bg-surface-muted/70 hover:bg-surface-muted rounded-lg p-2 border border-line/50 cursor-pointer transition-colors"
          title="Click to edit remark"
        >
          <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
          <span className="line-clamp-2 italic font-normal text-fg-muted">
            {remarkText}
          </span>
        </div>
      )}

      {/* Footer: Owner and Due Date / Overdue */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
        <div className="flex items-center gap-2">
          {owner ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={owner} title={deal.ownerEmail ?? owner} size="xs" />
              <span className="text-[11px] font-medium text-fg-muted truncate max-w-24">
                {owner}
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
              Unassigned
            </span>
          )}

          {onGenerateQuote && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateQuote(deal);
              }}
              className="p-1 rounded-md text-fg-subtle hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors cursor-pointer"
              title="Generate Quote from this deal"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

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

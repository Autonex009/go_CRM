import { memo, useState } from "react";
import {
  Calendar,
  AlertTriangle,
  Camera,
  MapPin,
  User,
  Layers,
  FileText,
  Plus,
  Check,
} from "lucide-react";

import { dueLabel, type Action } from "../actions/api";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { Avatar } from "../ui";
import type { Deal } from "./api";
import {
  PRIORITY_META,
  byPriority,
  completedItems,
  parseChecklist,
  pendingItems,
  type ChecklistItem,
} from "./checklist";
import { daysUntil, formatDate, isClosed } from "./stages";

interface DealCardProps {
  deal: Deal;
  overlay?: boolean;
  /** Opens the checklist editor. */
  onRemark?: (deal: Deal) => void;
  onGenerateQuote?: (deal: Deal) => void;
  /** This deal's actions, already filtered by the board so the card fetches nothing. */
  actions?: Action[];
  /** Actions are manager-only server-side; reps never see the tab. */
  canSeeActions?: boolean;
  /** Ticks one checklist item and persists the deal's remark. */
  onToggleTask?: (deal: Deal, itemId: string) => void;
  onCompleteAction?: (actionId: string) => void;
  /** Opens the Actions dialog pre-filled with this deal. */
  onAddAction?: (deal: Deal) => void;
  memberName?: (id: string | null) => string;
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

  return { cameras, location, leadName, products };
}

export const DealCard = memo(function DealCard({
  deal,
  overlay = false,
  onRemark,
  onGenerateQuote,
  actions,
  canSeeActions = false,
  onToggleTask,
  onCompleteAction,
  onAddAction,
  memberName,
}: DealCardProps) {
  const currency = useCurrency();
  const rawOwner = deal.ownerName?.trim() || deal.ownerEmail;
  const owner = /kedar\s*sathe/i.test(rawOwner || "") ? null : rawOwner;
  const days = isClosed(deal.stage) ? null : daysUntil(deal.expectedCloseDate);

  const { cameras, location, leadName, products } = parseDealCardInfo(deal);

  // A deal without its own name is still about a client, so the card says which
  // one rather than showing an empty header.
  const cardTitle = deal.title?.trim() || deal.accountName?.trim() || "Untitled deal";

  // The lead and contact already have their own row on this card, so their
  // names are stripped rather than repeated as a task.
  const items = parseChecklist(deal.remark ?? deal.description, [
    leadName ?? "",
    deal.contactName ?? "",
    deal.ownerName ?? "",
  ]);
  const pending = byPriority(pendingItems(items));
  const doneCount = completedItems(items).length;
  const openActions = (actions ?? []).filter((a) => a.status !== "done");

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
        <h4 className="line-clamp-2 text-sm font-bold leading-snug text-fg">
          {cardTitle}
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

      {/* Execution panel: quick checklist, or this deal's actions */}
      <TaskPanel
        deal={deal}
        pending={pending}
        doneCount={doneCount}
        openActions={openActions}
        canSeeActions={canSeeActions}
        memberName={memberName}
        onToggleTask={onToggleTask}
        onCompleteAction={onCompleteAction}
        onAddAction={onAddAction}
        onEdit={onRemark}
      />

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

/**
 * The card's two execution views. Tasks is the deal's own checklist — quick
 * ticking, no navigation. Actions is the same data the Actions dashboard owns,
 * so anything completed here shows as completed there and vice versa.
 *
 * Only the checkbox commits a change; the text opens the editor. On a board of
 * draggable cards a whole-row toggle is too easy to hit by accident, and a
 * mis-tick writes straight to the deal.
 */
function TaskPanel({
  deal,
  pending,
  doneCount,
  openActions,
  canSeeActions,
  memberName,
  onToggleTask,
  onCompleteAction,
  onAddAction,
  onEdit,
}: {
  deal: Deal;
  pending: ChecklistItem[];
  doneCount: number;
  openActions: Action[];
  canSeeActions: boolean;
  memberName?: (id: string | null) => string;
  onToggleTask?: (deal: Deal, itemId: string) => void;
  onCompleteAction?: (actionId: string) => void;
  onAddAction?: (deal: Deal) => void;
  onEdit?: (deal: Deal) => void;
}) {
  const [tab, setTab] = useState<"tasks" | "actions">("tasks");
  // The toggle is always present for managers, even on an empty deal: it is how
  // you reach the Actions side to add the first one.
  const showing = canSeeActions ? tab : "tasks";
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const addHere = showing === "tasks" ? onEdit : onAddAction;
  const addLabel = showing === "tasks" ? "Add task" : "Add action";

  return (
    <div className="mt-2.5 border-t border-line/60 pt-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5" onClick={stop}>
          <PanelTab
            active={showing === "tasks"}
            onClick={() => setTab("tasks")}
            count={pending.length}
          >
            Tasks
          </PanelTab>
          {canSeeActions && (
            <PanelTab
              active={showing === "actions"}
              onClick={() => setTab("actions")}
              count={openActions.length}
            >
              Actions
            </PanelTab>
          )}
        </div>

        {addHere && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              addHere(deal);
            }}
            className="rounded p-0.5 text-fg-subtle transition-colors hover:bg-indigo-500/10 hover:text-indigo-600"
            title={addLabel}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {(showing === "tasks" ? pending.length : openActions.length) === 0 && (
          <li>
            <button
              type="button"
              disabled={!addHere}
              onClick={(e) => {
                stop(e);
                addHere?.(deal);
              }}
              className="text-left text-[11px] italic text-fg-subtle transition-colors enabled:hover:text-indigo-600 disabled:cursor-default"
            >
              {showing === "tasks"
                ? doneCount > 0
                  ? "All tasks done"
                  : "No tasks yet — add one"
                : "No actions yet — add one"}
            </button>
          </li>
        )}

        {showing === "tasks" &&
          pending.slice(0, 3).map((item) => (
            <li key={item.id} className="group flex items-start gap-2" onClick={stop}>
              <button
                type="button"
                role="checkbox"
                aria-checked={false}
                disabled={!onToggleTask}
                onClick={() => onToggleTask?.(deal, item.id)}
                aria-label={`${PRIORITY_META[item.priority].label} priority — mark "${item.text}" done`}
                title={`${PRIORITY_META[item.priority].label} priority — mark done`}
                className={`mt-[2px] h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-transform enabled:hover:scale-125 disabled:cursor-default ${
                  PRIORITY_META[item.priority].ring
                }`}
              />
              <button
                type="button"
                onClick={() => onEdit?.(deal)}
                className="min-w-0 flex-1 text-left text-xs leading-snug text-fg-muted transition-colors group-hover:text-fg"
              >
                <span className="line-clamp-2">{item.text}</span>
              </button>
            </li>
          ))}

        {showing === "actions" &&
          openActions.slice(0, 3).map((action) => {
            const due = dueLabel(action);
            return (
              <li key={action.id} className="flex items-start gap-2" onClick={stop}>
                <button
                  type="button"
                  disabled={!onCompleteAction}
                  onClick={() => onCompleteAction?.(action.id)}
                  title="Mark done"
                  className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-line text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-500 disabled:cursor-default"
                >
                  <Check className="h-2.5 w-2.5" />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs leading-snug text-fg-muted">
                    {action.title}
                  </span>
                  {/* Who owns it is the reason this view exists — including
                      when nobody does yet, which is a prompt to go and pick. */}
                  {memberName && (
                    <span
                      className={`block truncate text-[10px] ${
                        action.assignedTo ? "text-fg-subtle" : "italic text-amber-600"
                      }`}
                    >
                      {memberName(action.assignedTo)}
                    </span>
                  )}
                </span>
                <span
                  className={`mt-[1px] shrink-0 text-[10px] ${
                    due.tone === "overdue"
                      ? "font-semibold text-rose-500"
                      : due.tone === "due"
                        ? "font-semibold text-amber-600"
                        : "text-fg-subtle"
                  }`}
                >
                  {due.text}
                </span>
              </li>
            );
          })}
      </ul>

      {showing === "tasks" && (pending.length > 3 || doneCount > 0) && (
        <p className="mt-1 text-[10px] text-fg-subtle">
          {pending.length > 3 && `+${pending.length - 3} more`}
          {pending.length > 3 && doneCount > 0 && " · "}
          {doneCount > 0 && `${doneCount} done`}
        </p>
      )}
      {showing === "actions" && openActions.length > 3 && (
        <p className="mt-1 text-[10px] text-fg-subtle">+{openActions.length - 3} more</p>
      )}
    </div>
  );
}

function PanelTab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-fg-subtle hover:text-fg-muted"
      }`}
    >
      {children}
      {count > 0 && <span className="ml-1 font-semibold tabular-nums opacity-70">{count}</span>}
    </button>
  );
}

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
import { PRIORITY_META, byPriority, type DealTask } from "./tasks";
import { daysUntil, formatDate, isClosed } from "./stages";

interface DealCardProps {
  deal: Deal;
  overlay?: boolean;
  /** Opens the task editor. */
  onRemark?: (deal: Deal) => void;
  onGenerateQuote?: (deal: Deal) => void;
  /** This deal's actions, already filtered by the board so the card fetches nothing. */
  actions?: Action[];
  /** This deal's tasks, likewise grouped by the board. */
  tasks?: DealTask[];
  /** Actions are manager-only server-side; reps never see the tab. */
  canSeeActions?: boolean;
  /** Ticks one task; the server records who did it. */
  onToggleTask?: (task: DealTask) => void;
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
  tasks,
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

  const allTasks = tasks ?? [];
  const pending = byPriority(allTasks.filter((t) => !t.done));
  const doneCount = allTasks.length - pending.length;
  const openActions = (actions ?? []).filter((a) => a.status !== "done");

  return (
    <article
      className={`group/card relative rounded-xl border bg-surface p-3.5 transition-all duration-150 ${
        overlay
          ? "rotate-1 scale-[1.02] border-indigo-500/50 shadow-xl"
          : "border-line hover:border-indigo-500/40 hover:shadow-md"
      }`}
    >
      {/* Title and amount. The amount is the one number worth reading from a
          metre away, so it gets the weight and the title gets the room. */}
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-fg">
          {cardTitle}
        </h4>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-fg">
          {formatMoneyCompact(deal.amount, currency)}
        </span>
      </div>

      {/* Lead Name */}
      {leadName && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-fg-muted">
          <User className="h-3 w-3 shrink-0 text-fg-subtle" />
          <span className="truncate" title={`Lead: ${leadName}`}>
            {leadName}
          </span>
        </div>
      )}

      {/* Cameras, location, products. One quiet chip family with the colour on
          the icon: three different coloured pills competed with the tasks below
          them, which is where the eye actually needs to land. */}
      {(cameras !== null || location || products) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {cameras !== null && (
            <InfoChip
              icon={<Camera className="h-3 w-3 shrink-0 text-sky-500" />}
              title={`${cameras} ${cameras === 1 ? "camera" : "cameras"}`}
            >
              {cameras} {cameras === 1 ? "cam" : "cams"}
            </InfoChip>
          )}

          {location && (
            <InfoChip
              icon={<MapPin className="h-3 w-3 shrink-0 text-amber-500" />}
              title={`Location: ${location}`}
            >
              {location}
            </InfoChip>
          )}

          {products && (
            <InfoChip
              icon={<Layers className="h-3 w-3 shrink-0 text-violet-500" />}
              title={`Products: ${products}`}
            >
              {products}
            </InfoChip>
          )}
        </div>
      )}

      {/* Execution panel: quick tasks, or this deal's actions */}
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

      {/* Footer: owner on the left, the date that matters on the right. The
          quote button only appears on hover — it is an occasional action, not
          something to read past on every card. */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line/60 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {owner ? (
            <>
              <Avatar name={owner} title={deal.ownerEmail ?? owner} size="xs" />
              <span className="max-w-24 truncate text-[11px] text-fg-muted">{owner}</span>
            </>
          ) : (
            <span className="text-[11px] italic text-fg-subtle">Unassigned</span>
          )}

          {onGenerateQuote && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateQuote(deal);
              }}
              className="rounded p-1 text-fg-subtle opacity-0 transition-all hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:opacity-100 group-hover/card:opacity-100"
              title="Generate quote from this deal"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {deal.expectedCloseDate &&
          (days !== null && days < 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              {Math.abs(days)}d late
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-fg-subtle">
              <Calendar className="h-3 w-3" />
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
  pending: DealTask[];
  doneCount: number;
  openActions: Action[];
  canSeeActions: boolean;
  memberName?: (id: string | null) => string;
  onToggleTask?: (task: DealTask) => void;
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
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-0.5 rounded-lg bg-surface-muted/70 p-0.5"
          onClick={stop}
        >
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
          pending.slice(0, 3).map((task) => (
            <li key={task.id} className="group flex items-start gap-2" onClick={stop}>
              <button
                type="button"
                role="checkbox"
                aria-checked={false}
                disabled={!onToggleTask}
                onClick={() => onToggleTask?.(task)}
                aria-label={`${PRIORITY_META[task.priority].label} priority — mark "${task.text}" done`}
                title={`${PRIORITY_META[task.priority].label} priority — mark done`}
                className={`mt-[2px] h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-transform enabled:hover:scale-125 disabled:cursor-default ${
                  PRIORITY_META[task.priority].ring
                }`}
              />
              <button
                type="button"
                onClick={() => onEdit?.(deal)}
                className="min-w-0 flex-1 text-left text-xs leading-snug text-fg-muted transition-colors group-hover:text-fg"
              >
                <span className="line-clamp-2">{task.text}</span>
              </button>
              {task.assignedToName && (
                <span className="mt-[1px] shrink-0 truncate text-[10px] text-fg-subtle">
                  {task.assignedToName}
                </span>
              )}
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
      className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-surface text-indigo-600 shadow-xs dark:text-indigo-400"
          : "text-fg-subtle hover:text-fg-muted"
      }`}
    >
      {children}
      {count > 0 && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
    </button>
  );
}

/** One muted metadata chip; only its icon carries colour. */
function InfoChip({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className="inline-flex max-w-[150px] items-center gap-1 rounded-md border border-line bg-surface-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-fg-muted"
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

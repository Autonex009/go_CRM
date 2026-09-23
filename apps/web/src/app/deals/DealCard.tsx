import { memo } from "react";
import {
  Calendar,
  AlertTriangle,
  Camera,
  MapPin,
  User,
  Layers,
  FileText,
  Plus,
  Wrench,
  ListChecks,
} from "lucide-react";

import type { Ask } from "../implementation/api";
import { ImplementationBlock, techSummary } from "../implementation/ImplementationBlock";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { Avatar } from "../ui";
import type { Deal } from "./api";
import { PRIORITY_META, byPriority, type DealTask } from "./tasks";
import { daysUntil, formatDate, isClosed } from "./stages";

interface DealCardProps {
  deal: Deal;
  overlay?: boolean;
  /** Opens the deal's working view. */
  onOpenWork?: (deal: Deal) => void;
  onGenerateQuote?: (deal: Deal) => void;
  /** This deal's implementation asks, grouped by the board so the card fetches nothing. */
  asks?: Ask[];
  /** This deal's tasks, likewise grouped by the board. */
  tasks?: DealTask[];
  /** Ticks one task; the server records who did it. */
  onToggleTask?: (task: DealTask) => void;
  /** Raises a new implementation ask against this deal. */
  onAddAsk?: (deal: Deal) => void;
  onOpenAsk?: (deal: Deal, ask: Ask) => void;
  /** Deletes an implementation ask, after its own confirm. */
  onDeleteAsk?: (ask: Ask) => void;
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
  onOpenWork,
  onGenerateQuote,
  asks,
  tasks,
  onToggleTask,
  onAddAsk,
  onOpenAsk,
  onDeleteAsk,
}: DealCardProps) {
  const currency = useCurrency();
  const rawOwner = deal.ownerName?.trim() || deal.ownerEmail;
  const owner = /kedar\s*sathe/i.test(rawOwner || "") ? null : rawOwner;
  const days = isClosed(deal.stage) ? null : daysUntil(deal.expectedCloseDate);

  const { cameras, location, leadName, products } = parseDealCardInfo(deal);

  // A deal without its own name is still about a client, so the card says which
  // one rather than showing an empty header.
  const cardTitle =
    deal.title?.trim() || deal.accountName?.trim() || "Untitled deal";

  const allTasks = tasks ?? [];
  const pending = byPriority(allTasks.filter((t) => !t.done));
  const doneCount = allTasks.length - pending.length;
  const dealAsks = asks ?? [];
  const openAsks = dealAsks.filter(
    (a) => a.status !== "verified" && a.status !== "wont_do",
  );
  const techChip = techSummary(dealAsks);
  const blockedAsks = openAsks.filter((a) => a.status === "blocked").length;
  const late = days !== null && days < 0;

  // A coloured edge only where it means something: overdue first, then work
  // that is stuck. A card with nothing wrong wears no colour, which is what
  // makes the ones that do stand out down a long column.
  const edge = late
    ? "border-l-[3px] border-l-rose-500"
    : blockedAsks > 0
      ? "border-l-[3px] border-l-amber-500"
      : "";

  return (
    <article
      className={`group/card relative rounded-xl border bg-surface transition-all duration-150 ${edge} ${
        overlay
          ? "rotate-1 scale-[1.02] border-accent/60 shadow-xl"
          : "border-line hover:-translate-y-px hover:border-accent/40 hover:shadow-md"
      }`}
    >
      <div className="p-3.5 pb-2.5">
        {/* Title and amount. The amount is the one number worth reading from a
            metre away, so it gets the weight and the title gets the room. */}
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-fg">
            {cardTitle}
          </h4>
          {deal.amount > 0 && (
            <span className="shrink-0 text-sm font-bold tabular-nums tracking-tight text-fg">
              {formatMoneyCompact(deal.amount, currency)}
            </span>
          )}
        </div>

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
        {(cameras !== null || location || products || techChip) && (
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
                icon={<Layers className="h-3 w-3 shrink-0 text-teal-500" />}
                title={`Products: ${products}`}
              >
                {products}
              </InfoChip>
            )}

            {techChip && (
              <InfoChip
                tone="tech"
                icon={<Wrench className="h-3 w-3 shrink-0 text-violet-500" />}
                title="Open implementation asks"
              >
                {techChip}
              </InfoChip>
            )}
          </div>
        )}
      </div>

      {/* Work: the deal's own checklist, then engineering's asks. One quiet
          surface behind both, instead of a rule above each. */}
      <div className="bg-surface-muted/40 px-3.5 py-2.5">
        <TaskPanel
          deal={deal}
          pending={pending}
          doneCount={doneCount}
          openAskCount={openAsks.length}
          onToggleTask={onToggleTask}
          onOpenWork={onOpenWork}
        />

        <ImplementationBlock
          asks={dealAsks}
          onAdd={onAddAsk ? () => onAddAsk(deal) : undefined}
          onOpen={onOpenAsk ? (ask) => onOpenAsk(deal, ask) : undefined}
          onDelete={onDeleteAsk}
        />
      </div>

      {/* Footer: owner on the left, the date that matters on the right. The
          quote button only appears on hover — it is an occasional action, not
          something to read past on every card. */}
      <div className="flex items-center justify-between gap-2 border-t border-line/60 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {owner ? (
            <>
              <Avatar name={owner} title={deal.ownerEmail ?? owner} size="xs" />
              <span className="max-w-24 truncate text-[11px] text-fg-muted">
                {owner}
              </span>
            </>
          ) : (
            <span className="text-[11px] italic text-fg-subtle">
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
              className="rounded p-1 text-fg-subtle opacity-0 transition-all hover:bg-accent-soft hover:text-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 group-hover/card:opacity-100"
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
  openAskCount,
  onToggleTask,
  onOpenWork,
}: {
  deal: Deal;
  pending: DealTask[];
  doneCount: number;
  openAskCount: number;
  onToggleTask?: (task: DealTask) => void;
  onOpenWork?: (deal: Deal) => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="mt-2.5 border-t border-line/60 pt-2">
      <div className="mb-2 flex items-stretch gap-1.5">
        {/* Both halves of the deal's work, side by side and each carrying its
            own count. They open the same working view, which shows the two
            panels together. */}
        <PanelTab
          label="Tasks"
          icon={<ListChecks className="h-3.5 w-3.5 shrink-0" />}
          count={pending.length}
          disabled={!onOpenWork}
          onClick={(e) => {
            stop(e);
            onOpenWork?.(deal);
          }}
        />
        {/* "IMP", not "Implementation": the full word does not fit beside
            Tasks on a 264px card and was truncating. The title spells it out. */}
        <PanelTab
          label="IMP"
          title="Open implementation"
          count={openAskCount}
          tone="tech"
          icon={<Wrench className="h-3.5 w-3.5 shrink-0" />}
          disabled={!onOpenWork}
          onClick={(e) => {
            stop(e);
            onOpenWork?.(deal);
          }}
        />

        {onOpenWork && (
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onOpenWork(deal);
            }}
            className="flex shrink-0 items-center justify-center rounded-lg border border-line px-2 text-fg-subtle transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
            title="Add task"
            aria-label="Add task"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {pending.length === 0 && (
          <li>
            <button
              type="button"
              disabled={!onOpenWork}
              onClick={(e) => {
                stop(e);
                onOpenWork?.(deal);
              }}
              className="text-left text-[11px] italic text-fg-subtle transition-colors enabled:hover:text-indigo-600 disabled:cursor-default"
            >
              {doneCount > 0 ? "All tasks done" : "No tasks yet — add one"}
            </button>
          </li>
        )}

        {pending.slice(0, 3).map((task) => (
          <li
            key={task.id}
            className="group flex items-start gap-2"
            onClick={stop}
          >
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
              onClick={() => onOpenWork?.(deal)}
              className="min-w-0 flex-1 text-left text-xs leading-snug text-fg-muted transition-colors group-hover:text-fg"
            >
              {/* Wraps onto as many lines as the task needs. It used to be
                    clamped to two, which cut the end off any task written as a
                    sentence — and a truncated instruction is worse than none.
                    `break-words` is what keeps a long unbroken token (a URL, a
                    part number) from pushing the card wider than its column. */}
              <span className="block whitespace-pre-wrap break-words">
                {task.text}
              </span>
            </button>
            {task.assignedToName && (
              <span className="mt-[1px] shrink-0 truncate text-[10px] text-fg-subtle">
                {task.assignedToName}
              </span>
            )}
          </li>
        ))}
      </ul>

      {(pending.length > 3 || doneCount > 0) && (
        <p className="mt-1 text-[10px] text-fg-subtle">
          {pending.length > 3 && `+${pending.length - 3} more`}
          {pending.length > 3 && doneCount > 0 && " · "}
          {doneCount > 0 && `${doneCount} done`}
        </p>
      )}
    </div>
  );
}

/** One muted metadata chip; only its icon carries colour. */
/** One of the card's two work tabs: a label, its count, and a chevron. */
function PanelTab({
  label,
  count,
  icon,
  tone = "quiet",
  disabled,
  onClick,
  title,
}: {
  label: string;
  /** Hover and accessible name, for a label that is an abbreviation. */
  title?: string;
  count: number;
  icon?: React.ReactNode;
  tone?: "quiet" | "tech";
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const styles =
    tone === "tech"
      ? "border-violet-500/25 bg-violet-500/10 text-violet-600 enabled:hover:border-violet-500/50 enabled:hover:bg-violet-500/15 dark:text-violet-300"
      : "border-line bg-surface-muted/70 text-fg-muted enabled:hover:border-accent/40 enabled:hover:bg-accent-soft enabled:hover:text-accent";

  const badge =
    tone === "tech"
      ? "bg-violet-500/20 text-violet-700 dark:text-violet-200"
      : "bg-surface text-fg";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? `Open ${label.toLowerCase()}`}
      // The label is spelled out for assistive tech, so it has to carry the
      // count too: aria-label replaces the visible text and its badge.
      aria-label={title ? `${title}${count > 0 ? `, ${count} open` : ""}` : undefined}
      // flex-1 so the two share the row evenly.
      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${styles}`}
    >
      {icon}
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span
          className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${badge}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function InfoChip({
  icon,
  title,
  children,
  tone = "quiet",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  /** `tech` tints the implementation chip to match the block below it, so the
   *  two read as the same thing at a glance. */
  tone?: "quiet" | "tech";
}) {
  const styles =
    tone === "tech"
      ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
      : "border-line bg-surface-muted/60 text-fg-muted";

  return (
    <span
      title={title}
      className={`inline-flex max-w-[150px] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${styles}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

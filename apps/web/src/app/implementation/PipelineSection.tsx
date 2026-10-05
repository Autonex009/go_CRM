import { useMemo, type ReactNode } from "react";
import { ChevronRight, MapPin, Pencil, UserRound } from "lucide-react";

import { Avatar, KanbanBoard } from "../ui";
import type { Ask, AskStatus } from "./api";
import { BOARD_STATUSES, IMPLEMENTATION_COLUMNS } from "./meta";
import type { PipelineGroup } from "./pipelineGroups";

interface PipelineSectionProps {
  group: PipelineGroup;
  expanded: boolean;
  onToggle: () => void;
  /** Shown only to roles that may manage pipelines. */
  onEdit?: () => void;
  renderCard: (ask: Ask, overlay: boolean) => ReactNode;
  onMove: (id: string, status: AskStatus) => void;
  onOpen: (ask: Ask) => void;
}

/**
 * One company's pipeline: a header that always shows what matters at a glance
 * (company, sites, manager, open/blocked/overdue), and the kanban underneath
 * when expanded. Collapsed sections render no board at all, which keeps a long
 * list of companies cheap.
 */
export function PipelineSection({
  group,
  expanded,
  onToggle,
  onEdit,
  renderCard,
  onMove,
  onOpen,
}: PipelineSectionProps) {
  const items = useMemo(
    () =>
      group.asks
        .filter((a) => BOARD_STATUSES.includes(a.status))
        .map((a) => ({ ...a, stage: a.status })),
    [group.asks],
  );
  const bodyId = `pipeline-${group.key}`;

  return (
    <section
      className={`rounded-xl border bg-surface transition-colors ${
        group.blocked > 0 ? "border-bad-fg/30" : "border-line"
      } ${group.archived ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-sm px-md py-sm">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-sm rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-150 ${
              expanded ? "rotate-90" : ""
            }`}
          />
          <Avatar name={group.title} size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-fg">{group.title}</span>
              {group.archived && (
                <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
                  Archived
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
              {group.locations && (
                <span className="flex min-w-0 items-center gap-1" title={group.locations}>
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{group.locations}</span>
                </span>
              )}
              {group.pipeline && (
                <span className="flex items-center gap-1">
                  <UserRound className="h-3 w-3 shrink-0" />
                  {group.managerName ?? "No manager"}
                </span>
              )}
            </span>
          </span>
        </button>

        <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
          <Badge>{group.open} open</Badge>
          {group.blocked > 0 && <Badge tone="bad">{group.blocked} blocked</Badge>}
          {group.overdue > 0 && <Badge tone="warn">{group.overdue} overdue</Badge>}
        </span>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${group.title} pipeline`}
            title="Edit pipeline"
            className="shrink-0 rounded-md p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {expanded && (
        <div id={bodyId} className="border-t border-line px-sm pb-sm pt-sm">
          {group.pipeline?.description && (
            <p className="mb-sm whitespace-pre-wrap rounded-md bg-surface-muted px-md py-sm text-xs text-fg-muted">
              {group.pipeline.description}
            </p>
          )}
          {items.length === 0 ? (
            <p className="px-md py-lg text-center text-xs text-fg-subtle">
              No open asks in this pipeline. Raise one from the company's deal card.
            </p>
          ) : (
            <KanbanBoard
              columns={IMPLEMENTATION_COLUMNS}
              items={items}
              renderCard={(item, overlay) => renderCard(item, overlay)}
              onMove={(id, stage) => onMove(id, stage as AskStatus)}
              onOpen={(item) => onOpen(item)}
              onAdd={undefined}
            />
          )}
        </div>
      )}
    </section>
  );
}

const BADGE_TONES = {
  plain: "bg-surface-muted text-fg-muted",
  bad: "bg-bad-soft text-bad-fg font-medium",
  warn: "bg-warn-soft text-warn-fg font-medium",
};

function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return <span className={`rounded-full px-2 py-0.5 ${BADGE_TONES[tone]}`}>{children}</span>;
}

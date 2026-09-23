import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useAuthStore } from "../auth/store";
import { AskDialog, type AskParent } from "../implementation/AskDialog";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskStatus,
} from "../implementation/api";
import { AskCard } from "../implementation/AskCard";
import { useDeleteAsk } from "../implementation/useDeleteAsk";
import {
  BOARD_STATUSES,
  IMPLEMENTATION_COLUMNS,
  isOverdue,
  parentName,
} from "../implementation/meta";
import { ApiError } from "../lib/api";
import { Alert, BoardSkeleton, EmptyState, KanbanBoard } from "../ui";

type View = "all" | "mine" | "blocked" | "overdue" | string;

/**
 * The implementation board: every open ask across every deal, grouped by
 * status. Same shared KanbanBoard as leads and deals — only the columns, the
 * card and the mutations differ.
 */
export default function Implementation() {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.user?.id);
  const [view, setView] = useState<View>("all");
  const [dealFilter, setDealFilter] = useState("");
  const [dialog, setDialog] = useState<Ask | null>(null);

  const query = useQuery({
    queryKey: ["implementation"],
    queryFn: () => implementationApi.board(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    void queryClient.invalidateQueries({ queryKey: ["dealAsks"] });
  };

  const move = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AskStatus;
      reason?: string;
    }) => implementationApi.move(id, status, reason ?? ""),
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AskInput }) =>
      implementationApi.update(id, input),
    onSuccess: invalidate,
  });

  const deleteAsk = useDeleteAsk((id) =>
    setDialog((d) => (d?.id === id ? null : d)),
  );

  const board = query.data;
  const counts = board?.counts;

  const deals = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of board?.asks ?? []) {
      const id = a.dealId ?? a.leadId;
      if (id && !seen.has(id)) seen.set(id, parentName(a));
    }
    return [...seen].map(([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [board]);

  const asks = useMemo(() => {
    const all = (board?.asks ?? []).filter(
      (a) => !dealFilter || a.dealId === dealFilter || a.leadId === dealFilter,
    );
    switch (view) {
      case "mine":
        return all.filter((a) => a.assignedTo && a.assignedTo === viewerId);
      case "blocked":
        return all.filter((a) => a.status === "blocked");
      case "overdue":
        return all.filter(isOverdue);
      case "all":
        return all;
      default:
        // Any other view is a type chip, e.g. "Client demand".
        return all.filter((a) => a.type === view);
    }
  }, [board, view, viewerId, dealFilter]);

  // KanbanBoard groups on `stage`, so each ask carries its status under that
  // name. Verified and Won't do have no column, so they are dropped here rather
  // than landing in a bucket nothing renders.
  const items = useMemo(
    () =>
      asks
        .filter((a) => BOARD_STATUSES.includes(a.status))
        .map((a) => ({ ...a, stage: a.status })),
    [asks],
  );

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-sm pb-1">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-fg">
          Implementation
        </h1>
        {counts && (
          <p className="flex items-center gap-1.5 text-sm tabular-nums text-fg-muted">
            <span className="font-medium text-fg">{counts.open}</span> open
            <span className="text-fg-subtle">·</span>
            <span
              className={counts.blocked > 0 ? "font-medium text-bad-fg" : undefined}
            >
              {counts.blocked} blocked
            </span>
            <span className="text-fg-subtle">·</span>
            <span
              className={counts.overdue > 0 ? "font-medium text-warn-fg" : undefined}
            >
              {counts.overdue} overdue
            </span>
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Chip active={view === "all"} onClick={() => setView("all")}>
          All
        </Chip>
        <Chip active={view === "mine"} onClick={() => setView("mine")}>
          My asks {counts?.mine ? `· ${counts.mine}` : ""}
        </Chip>

        {(board?.types ?? []).length > 0 && (
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
        )}
        {(board?.types ?? []).map((t) => (
          <Chip key={t} active={view === t} onClick={() => setView(t)}>
            {t} {counts?.byType?.[t] ? `· ${counts.byType[t]}` : ""}
          </Chip>
        ))}

        <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
        <Chip
          active={view === "blocked"}
          tone="bad"
          onClick={() => setView("blocked")}
        >
          Blocked {counts?.blocked ? `· ${counts.blocked}` : ""}
        </Chip>
        <Chip
          active={view === "overdue"}
          tone="warn"
          onClick={() => setView("overdue")}
        >
          Overdue {counts?.overdue ? `· ${counts.overdue}` : ""}
        </Chip>

        {/* "By deal" narrows the board to one deal's asks, for a stand-up that
            is about a single client rather than the queue as a whole. */}
        <select
          value={dealFilter}
          onChange={(e) => setDealFilter(e.target.value)}
          aria-label="Filter by deal"
          className={`rounded-full border px-md py-1 text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
            dealFilter
              ? "border-accent/40 bg-accent-soft text-accent-on"
              : "border-line bg-surface text-fg-muted hover:text-fg"
          }`}
        >
          <option value="">By deal</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError
            ? query.error.message
            : "Could not load the implementation board"}
        </Alert>
      )}

      {query.isPending ? (
        <BoardSkeleton columns={IMPLEMENTATION_COLUMNS} />
      ) : (board?.asks ?? []).length === 0 ? (
        <EmptyState
          icon="check"
          title="No implementation asks yet"
          description="Raise one from a deal card — the deal and company fill themselves in."
        />
      ) : (
        <KanbanBoard
          columns={IMPLEMENTATION_COLUMNS}
          items={items}
          renderCard={(item, overlay) => (
            <AskCard ask={item} overlay={overlay} onDelete={deleteAsk} />
          )}
          onMove={(id, stage) => {
            const status = stage as AskStatus;
            // A blocked ask without a reason is the one card nobody can act on,
            // so the move asks for it rather than leaving the chip bare.
            const reason =
              status === "blocked"
                ? window.prompt("What is it blocked on?")?.trim() ?? ""
                : "";
            move.mutate({ id, status, reason });
          }}
          onOpen={(item) => setDialog(item)}
          // Every ask belongs to a deal or lead, so it is raised from there.
          onAdd={undefined}
        />
      )}

      {dialog && (
        <AskDialog
          ask={dialog}
          parent={parentOf(dialog)}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.id, input })}
          onStatusChange={async (status, reason) => {
            await move.mutateAsync({ id: dialog.id, status, reason });
            setDialog(null);
          }}
          onDelete={() => deleteAsk(dialog)}
        />
      )}
    </section>
  );
}

function parentOf(ask: Ask): AskParent {
  const company = ask.accountName ?? "";
  const where = ask.dealTitle ?? ask.leadTitle ?? "";
  return {
    dealId: ask.dealId ?? undefined,
    leadId: ask.leadId ?? undefined,
    company: company || where,
    label: [company, where].filter(Boolean).join(" — ") || "Unlinked",
  };
}

// A filled chip uses white text, the way Button's primary variant does.
// accent-on is a dark indigo meant for text *on* accent-soft, so pairing it
// with a solid accent fill rendered indigo on indigo — unreadable.
const CHIP_TONES = {
  plain: {
    on: "bg-accent text-white",
    off: "bg-surface-muted text-fg-muted hover:bg-surface-hover hover:text-fg",
  },
  bad: {
    on: "bg-bad-solid text-white",
    off: "bg-bad-soft text-bad-fg hover:brightness-95",
  },
  warn: {
    on: "bg-warn-fg text-white",
    off: "bg-warn-soft text-warn-fg hover:brightness-95",
  },
};

function Chip({
  active,
  onClick,
  children,
  tone = "plain",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: keyof typeof CHIP_TONES;
}) {
  const styles = CHIP_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-md py-1 text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
        active ? styles.on : styles.off
      }`}
    >
      {children}
    </button>
  );
}

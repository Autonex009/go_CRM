import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

import { useAuthStore } from "../auth/store";
import { AskDialog, type AskParent } from "../implementation/AskDialog";
import {
  ASK_PRIORITIES,
  implementationApi,
  type Ask,
  type AskInput,
  type AskPriority,
  type AskStatus,
} from "../implementation/api";
import { AskCard } from "../implementation/AskCard";
import { useDeleteAsk } from "../implementation/useDeleteAsk";
import {
  BOARD_STATUSES,
  IMPLEMENTATION_COLUMNS,
  PRIORITY_META,
  isOverdue,
  parentName,
} from "../implementation/meta";
import { ApiError } from "../lib/api";
import {
  Alert,
  BoardSkeleton,
  Button,
  EmptyState,
  Field,
  KanbanBoard,
  Modal,
  SelectField,
  TextareaField,
} from "../ui";

type View = "all" | "mine" | "blocked" | "overdue" | string;

/**
 * The implementation board: every open ask across every deal, grouped by
 * status. Same shared KanbanBoard as leads and deals — only the columns, the
 * card and the mutations differ.
 */
export default function Implementation() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id;
  const isEngineer = user?.role === "engineer";
  const isManager = user?.role === "manager";
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [view, setView] = useState<View>("all");
  const [dealFilter, setDealFilter] = useState("");
  const [dialog, setDialog] = useState<Ask | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const myAssignedTasks = useMemo(() => {
    const openTasks = (board?.asks ?? []).filter(
      (a) => !a.parentAskId && a.status !== "verified" && a.status !== "wont_do",
    );
    if (openTasks.length > 0) return openTasks;
    const mainTasks = (board?.asks ?? []).filter((a) => !a.parentAskId);
    return mainTasks.length > 0 ? mainTasks : (board?.asks ?? []);
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
      <header className="flex flex-wrap items-center justify-between gap-sm pb-1">
        <div className="flex flex-wrap items-baseline gap-sm">
          <h1 className="text-lg font-semibold tracking-[-0.01em] text-fg">
            {isEngineer ? "My Tasks" : "Implementation"}
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
        </div>

        <div className="flex items-center gap-2">
          {isEngineer && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon="plus"
              onClick={() => setShowCreateModal(true)}
            >
              New Sub-task Card
            </Button>
          )}

          {(isManager || isAdmin) && (
            <Link
              to="/implementation/team-tasks"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1 text-xs font-semibold text-fg shadow-sm hover:border-accent/40 hover:bg-surface-hover"
            >
              <Users className="h-3.5 w-3.5 text-indigo-500" />
              <span>Engineer Tasks Matrix</span>
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <Chip active={view === "all"} onClick={() => setView("all")}>
          {isEngineer ? "All My Tasks" : "All"}
        </Chip>
        {!isEngineer && (
          <Chip active={view === "mine"} onClick={() => setView("mine")}>
            My asks {counts?.mine ? `· ${counts.mine}` : ""}
          </Chip>
        )}

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

        {/* "By deal" narrows the board to one deal's asks. Hidden for engineers (commercial data shielding) */}
        {!isEngineer && (
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
        )}
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
          title={isEngineer ? "No tasks assigned to you" : "No implementation asks yet"}
          description={
            isEngineer
              ? "Tasks and sub-tasks assigned to you by your manager will show up here."
              : "Raise one from a deal card — the deal and company fill themselves in."
          }
        />
      ) : (
        <KanbanBoard
          columns={IMPLEMENTATION_COLUMNS}
          items={items}
          renderCard={(item, overlay) => (
            <AskCard
              ask={item}
              overlay={overlay}
              onDelete={isEngineer ? undefined : deleteAsk}
            />
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
          key={dialog.id}
          ask={dialog}
          parent={parentOf(dialog)}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.id, input })}
          onStatusChange={async (status, reason) => {
            await move.mutateAsync({ id: dialog.id, status, reason });
            setDialog(null);
          }}
          onDelete={() => deleteAsk(dialog)}
          onSelectSubtask={(st) => setDialog(st)}
        />
      )}

      {showCreateModal && (
        <CreateEngineerCardModal
          assignedTasks={myAssignedTasks}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            invalidate();
          }}
        />
      )}
    </section>
  );
}

function CreateEngineerCardModal({
  assignedTasks,
  onClose,
  onCreated,
}: {
  assignedTasks: Ask[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [parentAskId, setParentAskId] = useState(assignedTasks[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<AskPriority>("p1");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parentAskId && assignedTasks.length > 0) {
      setParentAskId(assignedTasks[0].id);
    }
  }, [assignedTasks, parentAskId]);

  const createMutation = useMutation({
    mutationFn: (input: AskInput) => implementationApi.create(input),
    onSuccess: onCreated,
    onError: (err: any) => setError(err?.message || "Could not create card"),
  });

  const selectedParent = assignedTasks.find((t) => t.id === parentAskId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentAskId) {
      setError("Please select an assigned task to link this card to");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title for the card");
      return;
    }
    createMutation.mutate({
      parentAskId,
      title: title.trim(),
      type: selectedParent?.type || "engineering",
      detail: detail.trim(),
      priority,
      dueAt: dueAt ? `${dueAt}T00:00:00Z` : null,
    });
  };

  return (
    <Modal title="Create Sub-task Card" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {assignedTasks.length === 0 ? (
          <div className="rounded-lg bg-surface-muted p-4 text-center text-xs text-fg-muted">
            <p className="font-semibold text-fg">No assigned tasks available</p>
            <p className="mt-1">
              You must have an assigned implementation task before you can create subtask cards linked to it.
            </p>
          </div>
        ) : (
          <>
            <SelectField
              label="Link to Assigned Task *"
              name="parentTask"
              value={parentAskId}
              onChange={(e) => setParentAskId(e.target.value)}
              required
            >
              {assignedTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {parentName(t) ? `${parentName(t)} — ` : ""}{t.title}
                </option>
              ))}
            </SelectField>

            <Field
              label="Card Title *"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement webhook retry handler"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-muted">Priority</span>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-muted/60 p-1">
                  {ASK_PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                        priority === p
                          ? PRIORITY_META[p].chip
                          : "text-fg-muted hover:text-fg"
                      }`}
                    >
                      {PRIORITY_META[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="Due Date"
                name="dueAt"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            <TextareaField
              label="Technical Details / Notes"
              name="detail"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Technical specs, endpoints, acceptance criteria…"
            />
          </>
        )}

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {assignedTasks.length > 0 && (
            <Button
              type="submit"
              disabled={createMutation.isPending}
              icon="check"
            >
              Create Card
            </Button>
          )}
        </div>
      </form>
    </Modal>
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

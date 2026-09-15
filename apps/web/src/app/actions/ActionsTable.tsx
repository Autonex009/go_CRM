import { Link } from "react-router-dom";

import { Badge, Button } from "../ui";
import { ACTION_STATUS_LABEL, dueLabel, isOverdue, type Action, type ActionStatus } from "./api";

const STATUS_TONE: Record<ActionStatus, "neutral" | "info" | "success"> = {
  open: "neutral",
  in_progress: "info",
  done: "success",
};

interface ActionsTableProps {
  actions: Action[];
  assigneeName: (id: string | null) => string;
  /** Omit to hide the client column — the company profile already has that context. */
  clientName?: (id: string | null) => string;
  /** Optional lookup to render linked lead context. */
  leadName?: (id: string | null) => string | undefined;
  onOpen: (action: Action) => void;
  onComplete: (id: string) => void;
  busy?: boolean;
}

/** The actions table, shared by the dashboard and the company profile tab. */
export function ActionsTable({
  actions,
  assigneeName,
  clientName,
  leadName,
  onOpen,
  onComplete,
  busy = false,
}: ActionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th className="px-lg py-sm font-medium">Action</th>
            {clientName && <th className="px-lg py-sm font-medium">Client</th>}
            <th className="px-lg py-sm font-medium">Assignee</th>
            <th className="px-lg py-sm font-medium">Due</th>
            <th className="px-lg py-sm font-medium">Status</th>
            <th className="px-lg py-sm font-medium" />
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => {
            const due = dueLabel(action);
            const overdue = isOverdue(action);

            return (
              <tr
                key={action.id}
                className={`border-b border-line transition-colors duration-100 last:border-0 ${
                  overdue ? "bg-bad-soft/40 hover:bg-bad-soft/60" : "hover:bg-surface-hover"
                }`}
              >
                <td className="px-lg py-sm">
                  <div className="flex flex-col">
                    <button
                      onClick={() => onOpen(action)}
                      className="text-left font-medium text-fg hover:underline"
                    >
                      {action.title}
                    </button>
                    {leadName && action.leadId && leadName(action.leadId) && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-fg-subtle">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        Lead: {leadName(action.leadId)}
                      </span>
                    )}
                  </div>
                </td>

                {clientName && (
                  <td className="px-lg py-sm text-fg-muted">
                    {action.accountId ? (
                      <Link
                        to={`/accounts/${action.accountId}`}
                        className="text-fg transition-colors hover:text-accent hover:underline"
                      >
                        {clientName(action.accountId)}
                      </Link>
                    ) : (
                      clientName(action.accountId)
                    )}
                  </td>
                )}

                <td className="px-lg py-sm text-fg-muted">{assigneeName(action.assignedTo)}</td>

                <td
                  className={`px-lg py-sm text-xs ${
                    due.tone === "overdue"
                      ? "font-medium text-bad-fg"
                      : due.tone === "due"
                        ? "font-medium text-warn-fg"
                        : "text-fg-muted"
                  }`}
                >
                  {due.text}
                </td>

                <td className="px-lg py-sm">
                  <Badge tone={STATUS_TONE[action.status]} dot>
                    {ACTION_STATUS_LABEL[action.status]}
                  </Badge>
                </td>

                <td className="px-lg py-sm text-right">
                  {action.status !== "done" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => onComplete(action.id)}
                    >
                      Mark done
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

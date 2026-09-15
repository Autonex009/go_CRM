import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ActionDialog } from "../../actions/ActionDialog";
import { ActionsTable } from "../../actions/ActionsTable";
import { actionsApi, type Action } from "../../actions/api";
import { useActionMutations } from "../../actions/useActionMutations";
import { ApiError } from "../../lib/api";
import { leadsApi } from "../../leads/api";
import { memberLabel, orgApi } from "../../org/api";
import { Alert, Button, Card, CardHeader, EmptyState, Skeleton } from "../../ui";

interface ActionsTabProps {
  accountId: string;
}

/**
 * The company profile's actions tab. It shares its query key with the header
 * count on the profile page, so both come from one request.
 */
export function ActionsTab({ accountId }: ActionsTabProps) {
  const [dialog, setDialog] = useState<{ action: Action | null } | null>(null);
  const { save, remove, complete, error } = useActionMutations();

  const query = useQuery({
    queryKey: ["actions", { accountId }],
    queryFn: () => actionsApi.list({ accountId }),
  });

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const leadsQuery = useQuery({
    queryKey: ["accountLeads", accountId],
    queryFn: () => leadsApi.list(0, "", 100, { accountId }),
    staleTime: 60_000,
  });

  const memberName = useMemo(() => {
    const map = new Map((members.data ?? []).map((m) => [m.id, memberLabel(m)]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "Unassigned");
  }, [members.data]);

  const leadName = useMemo(() => {
    const map = new Map(
      (leadsQuery.data?.items ?? []).map((l) => [l.id, `${l.firstName} ${l.lastName || ""}`.trim()]),
    );
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [leadsQuery.data]);

  const actions = query.data ?? [];
  const openCount = actions.filter((a) => a.status !== "done").length;

  const deleteAction = (id: string) => {
    if (!window.confirm("Delete this action?")) return;
    remove.mutate(id);
    setDialog(null);
  };

  const addButton = (
    <Button size="sm" icon="plus" onClick={() => setDialog({ action: null })}>
      Add action
    </Button>
  );

  return (
    <div className="mt-md flex flex-col gap-lg">
      <Card padded={false}>
        <div className="p-md">
          <CardHeader
            title={`Actions (${actions.length})`}
            subtitle={
              actions.length > 0
                ? `${openCount} open action${openCount === 1 ? "" : "s"} planned for this client`
                : "Plan and track follow-ups and tasks for this client."
            }
            action={addButton}
          />
        </div>

        {error && (
          <div className="px-md pb-md">
            <Alert>{error}</Alert>
          </div>
        )}
        {query.isError && (
          <div className="px-md pb-md">
            <Alert>
              {query.error instanceof ApiError ? query.error.message : "Could not load actions"}
            </Alert>
          </div>
        )}

        {query.isPending ? (
          <div className="flex flex-col gap-sm p-md">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[44px] w-full" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="p-md">
            <EmptyState
              icon="check"
              title="No actions for this company"
              description="Keep client tasks, calls, and follow-ups on track."
              action={addButton}
            />
          </div>
        ) : (
          <ActionsTable
            actions={actions}
            assigneeName={memberName}
            leadName={leadName}
            onOpen={(action) => setDialog({ action })}
            onComplete={(id) => complete.mutate(id)}
            busy={complete.isPending}
          />
        )}
      </Card>

      {dialog && (
        <ActionDialog
          action={dialog.action}
          defaultAccountId={accountId}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.action?.id, input })}
          onDelete={dialog.action ? () => deleteAction(dialog.action!.id) : undefined}
        />
      )}
    </div>
  );
}

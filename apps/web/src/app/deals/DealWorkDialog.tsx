import { Badge, Modal } from "../ui";
import type { Deal } from "./api";
import { DealActionsPanel } from "./DealActionsPanel";
import { getStageMeta, stageLabel } from "./stages";
import { DealTasksPanel } from "./TasksDialog";

interface DealWorkDialogProps {
  deal: Deal;
  onClose: () => void;
}

/**
 * The deal's working surface: its task checklist beside its actions.
 *
 * Both halves at once, with nothing to switch between them. The one question
 * this dialog exists to answer — what is outstanding on this deal, and who has
 * it — is answered by the two lists together, and a toggle would make reading
 * one mean hiding the other.
 *
 * Below `lg` there is no room for two columns, so they stack: tasks first,
 * because the checklist is the deal's own detail and the actions table is the
 * wider plan it sits inside.
 */
export function DealWorkDialog({ deal, onClose }: DealWorkDialogProps) {
  const name =
    deal.title?.trim() || deal.accountName?.trim() || "Untitled deal";

  return (
    <Modal
      size="xl"
      flush
      title={name}
      onClose={onClose}
      headerAction={
        <Badge tone={getStageMeta(deal.stage).tone} dot>
          {stageLabel(deal.stage)}
        </Badge>
      }
    >
      {/* Stacked and scrolling as one below `lg`; two independently scrolling
          halves above it. `basis-0` with `flex-1` is what makes the halves even
          rather than a share of the leftover space — without it the denser
          actions panel would claim more of the dialog than the checklist. */}
      <div className="h-full overflow-y-auto overscroll-contain lg:flex lg:overflow-hidden">
        <section
          aria-label="Tasks"
          className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col border-b border-line lg:border-b-0 lg:border-r"
        >
          <PanelHeading>Tasks</PanelHeading>
          <div className="p-lg pt-md lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            <DealTasksPanel deal={deal} />
          </div>
        </section>

        <section
          aria-label="Actions"
          className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col"
        >
          <PanelHeading>Actions</PanelHeading>
          <DealActionsPanel deal={deal} />
        </section>
      </div>
    </Modal>
  );
}

/** Names each half, since the dialog header carries the deal, not the panel. */
function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="shrink-0 px-lg pt-lg text-[11px] font-bold uppercase tracking-wider text-fg-muted">
      {children}
    </h3>
  );
}

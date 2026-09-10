import type { LinkedContact, ProfileInput } from "../api";
import { Card, CardHeader } from "../../ui";
import { Timeline } from "../../activities/Timeline";
import { RecordTable } from "./RecordTable";
import { contactColumns } from "./columns";

/**
 * The Overview tab's side column: hardware inventory, who to call, and the
 * activity feed.
 *
 * The contacts list is read-only — contacts belong to the contacts page, and the
 * profile only needs to say who they are.
 */
export function ProfileSidebar({
  accountId,
  mode,
  formData,
  setFormData,
  contacts,
}: {
  accountId: string;
  mode: "preview" | "edit";
  formData: ProfileInput;
  setFormData: (next: ProfileInput) => void;
  contacts: LinkedContact[];
}) {
  return (
    <div className="flex flex-col gap-lg">
      {/* Hardware Infrastructure */}
      <Card>
        <CardHeader title="Hardware Infrastructure" className="mb-md" />
        <div className="flex flex-col gap-sm text-xs">
          <div className="flex justify-between items-center py-xs border-b border-line">
            <span className="text-fg-muted">Edge Processor:</span>
            {mode === "edit" ? (
              <input
                type="text"
                className="bg-surface border border-line rounded px-xs py-xs text-xs text-fg w-32"
                value={formData.hardwareSpecs?.edgeProcessor || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hardwareSpecs: {
                      ...formData.hardwareSpecs,
                      edgeProcessor: e.target.value,
                    },
                  })
                }
              />
            ) : (
              <span className="font-medium text-fg">
                {formData.hardwareSpecs?.edgeProcessor || "N/A"}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center py-xs border-b border-line">
            <span className="text-fg-muted">Camera Stream Count:</span>
            {mode === "edit" ? (
              <input
                type="number"
                className="bg-surface border border-line rounded px-xs py-xs text-xs text-fg w-32"
                value={formData.hardwareSpecs?.cameraCount || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hardwareSpecs: {
                      ...formData.hardwareSpecs,
                      cameraCount: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            ) : (
              <span className="font-medium text-fg">
                {formData.hardwareSpecs?.cameraCount || 0} Streams
              </span>
            )}
          </div>
          <div className="flex justify-between items-center py-xs border-b border-line">
            <span className="text-fg-muted">
              Audio / Speaker Units:
            </span>
            {mode === "edit" ? (
              <input
                type="number"
                className="bg-surface border border-line rounded px-xs py-xs text-xs text-fg w-32"
                value={formData.hardwareSpecs?.speakerCount || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hardwareSpecs: {
                      ...formData.hardwareSpecs,
                      speakerCount: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            ) : (
              <span className="font-medium text-fg">
                {formData.hardwareSpecs?.speakerCount || 0} Units
              </span>
            )}
          </div>
          <div className="flex justify-between items-center py-xs">
            <span className="text-fg-muted">NVR / CCTV Make:</span>
            {mode === "edit" ? (
              <input
                type="text"
                className="bg-surface border border-line rounded px-xs py-xs text-xs text-fg w-32"
                value={formData.hardwareSpecs?.nvrMake || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    hardwareSpecs: {
                      ...formData.hardwareSpecs,
                      nvrMake: e.target.value,
                    },
                  })
                }
              />
            ) : (
              <span className="font-medium text-fg">
                {formData.hardwareSpecs?.nvrMake || "N/A"}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader title={`Contacts (${contacts.length})`} className="mb-md" />
        <RecordTable
          columns={contactColumns()}
          rows={contacts}
          rowKey={(c) => c.id}
          minWidth={320}
          empty={{
            icon: "contacts",
            title: "No contacts recorded",
            description: "Contacts added against this company appear here.",
          }}
        />
      </Card>

      <Timeline scope={{ accountId }} />
    </div>
  );
}

import type { ProfileInput } from "../api";
import { Badge, Button, Card, CardHeader } from "../../ui";
import { PlantSitesCard } from "./PlantSitesCard";
import { SpecList } from "./SpecList";
import type { ProfileMetrics } from "./metrics";

/**
 * Detections offered as one-click suggestions when editing the AI module.
 *
 * A starting menu, not a closed set — the field takes free text too, because
 * every plant eventually wants something not on this list.
 */
const COMMON_AI_DETECTIONS = [
  "PPE & Hard Hat Compliance",
  "Fire & Smoke Detection",
  "Perimeter Intrusion Alert",
  "Machine Guarding Violation",
  "Oil / Chemical Leakage",
  "Conveyor Belt Misalignment",
  "Forklift Speed & Proximity",
  "Restricted Area Entry",
  "Worker Down / Motionless",
];

/**
 * The Overview tab's main column: what the company is, and what we have
 * deployed for them.
 *
 * Everything here is profile content, so it takes the edit form and none of the
 * linked deals or leads. That is the seam worth having — typing into a plant
 * address no longer re-renders the pipeline metrics above it.
 */
export function ProfileDetails({
  accountId,
  mode,
  formData,
  setFormData,
  metrics,
}: {
  accountId: string;
  mode: "preview" | "edit";
  formData: ProfileInput;
  setFormData: (next: ProfileInput) => void;
  /** Read only for the deployment strip — the form itself never touches it. */
  metrics: ProfileMetrics;
}) {
  // Sites live in their own table now and are counted by PlantSitesCard. This
  // strip still reads the legacy array so an older profile that was never
  // re-saved does not show zero where it used to show a number.
  const sites = formData.plantLocations?.length ?? 0;
  const modules = formData.aiDetections?.length ?? 0;
  return (
    <div className="md:col-span-2 flex flex-col gap-lg">
      {/* Company Description Card */}
      <Card>
        <CardHeader title="About Company" className="mb-md" />
        {mode === "edit" ? (
          <textarea
            rows={4}
            className="w-full text-sm bg-surface border border-line rounded-md p-sm text-fg"
            placeholder="Enter company description, history, or key technical overview..."
            value={formData.description || ""}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        ) : (
          <>
            <p className="text-sm leading-relaxed text-fg-muted">
              {formData.description || "No company description provided yet."}
            </p>

            {/* What is actually deployed, read off the deals and the profile.
                The counts come from two different places on purpose: cameras and
                sites are what the deals committed to, plant sites and modules
                are what the profile records. Seeing them side by side is how a
                gap between the two becomes visible. */}
            <SpecList
              className="mt-md border-t border-line pt-md"
              columns={4}
              items={[
                {
                  label: "Cameras scoped",
                  value:
                    metrics.totalCameras > 0
                      ? metrics.totalCameras.toLocaleString()
                      : "—",
                  note:
                    metrics.totalCameras > 0
                      ? `across ${metrics.scopedDeals} deal${metrics.scopedDeals === 1 ? "" : "s"}`
                      : "no deal carries a count",
                },
                {
                  label: "Sites in deals",
                  value:
                    metrics.siteCount > 0 ? String(metrics.siteCount) : "—",
                  note: "named by deal locations",
                },
                {
                  label: "Plant sites",
                  value: sites > 0 ? String(sites) : "—",
                  note: "on the profile",
                },
                {
                  label: "AI modules",
                  value: modules > 0 ? String(modules) : "—",
                  note: "active detections",
                },
              ]}
            />
          </>
        )}
      </Card>

      {/* VIGIL AI Detections Module */}
      <Card>
        <CardHeader
          title="Active VIGIL AI Detection Modules"
          className="mb-md"
        />
        {mode === "edit" ? (
          <div className="flex flex-col gap-sm">
            <p className="text-xs text-fg-muted">
              Select AI detection models deployed at company sites:
            </p>
            <div className="flex flex-wrap gap-xs">
              {COMMON_AI_DETECTIONS.map((det) => {
                const isSelected = formData.aiDetections?.includes(det);
                return (
                  <button
                    key={det}
                    type="button"
                    onClick={() => {
                      const current = formData.aiDetections || [];
                      const next = isSelected
                        ? current.filter((item) => item !== det)
                        : [...current, det];
                      setFormData({ ...formData, aiDetections: next });
                    }}
                    className={`text-xs px-sm py-xs rounded-md border transition-colors ${
                      isSelected
                        ? "bg-brand/10 border-brand text-brand font-medium"
                        : "bg-surface-muted border-line text-fg-muted hover:border-fg-subtle"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {det}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-xs">
            {formData.aiDetections && formData.aiDetections.length > 0 ? (
              formData.aiDetections.map((det) => (
                <Badge key={det} tone="brand">
                  {det}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-fg-subtle">
                No active AI detection modules assigned.
              </span>
            )}
          </div>
        )}
      </Card>

      {/* The company's sites. Rows now, not the profile's JSONB array, so a
          deal can point at one — see PlantSitesCard. It saves on its own,
          outside this form's Save. */}
      <PlantSitesCard accountId={accountId} editable={mode === "edit"} />

      {/* Custom Sections Builder */}
      {formData.customSections &&
        formData.customSections.map((sec, idx) => (
          <Card key={idx}>
            <CardHeader title={sec.title} className="mb-md" />
            {mode === "edit" ? (
              <div className="flex flex-col gap-sm">
                <input
                  type="text"
                  className="w-full text-sm font-medium bg-surface border border-line rounded px-sm py-xs text-fg"
                  value={sec.title}
                  onChange={(e) => {
                    const secs = [...(formData.customSections || [])];
                    secs[idx] = { ...secs[idx], title: e.target.value };
                    setFormData({ ...formData, customSections: secs });
                  }}
                />
                <textarea
                  rows={3}
                  className="w-full text-xs bg-surface border border-line rounded p-sm text-fg"
                  value={sec.content}
                  onChange={(e) => {
                    const secs = [...(formData.customSections || [])];
                    secs[idx] = {
                      ...secs[idx],
                      content: e.target.value,
                    };
                    setFormData({ ...formData, customSections: secs });
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const secs = (formData.customSections || []).filter(
                        (_, i) => i !== idx,
                      );
                      setFormData({
                        ...formData,
                        customSections: secs,
                      });
                    }}
                  >
                    <span className="text-bad-fg text-xs">Remove Section</span>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted whitespace-pre-wrap">
                {sec.content}
              </p>
            )}
          </Card>
        ))}

      {mode === "edit" && (
        <Button
          variant="secondary"
          icon="plus"
          onClick={() => {
            const secs = formData.customSections || [];
            setFormData({
              ...formData,
              customSections: [
                ...secs,
                { title: "Custom Documentation Section", content: "" },
              ],
            });
          }}
        >
          Add Custom Section
        </Button>
      )}
    </div>
  );
}

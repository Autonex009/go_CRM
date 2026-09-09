import type { ProfileInput } from "../api";
import { Badge, Button, Card, CardHeader } from "../../ui";

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
  mode,
  formData,
  setFormData,
}: {
  mode: "preview" | "edit";
  formData: ProfileInput;
  setFormData: (next: ProfileInput) => void;
}) {
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
          <p className="text-sm text-fg-muted leading-relaxed">
            {formData.description ||
              "No company description provided yet."}
          </p>
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
            {formData.aiDetections &&
            formData.aiDetections.length > 0 ? (
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

      {/* Plant Locations & Sites */}
      <Card>
        <CardHeader
          title={`Plant Sites (${formData.plantLocations?.length || 0})`}
          action={
            mode === "edit" ? (
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => {
                  const locs = formData.plantLocations || [];
                  setFormData({
                    ...formData,
                    plantLocations: [
                      ...locs,
                      {
                        name: "New Plant",
                        city: "",
                        address: "",
                        spocName: "",
                        spocPhone: "",
                      },
                    ],
                  });
                }}
              >
                Add Site
              </Button>
            ) : undefined
          }
          className="mb-md"
        />
        {formData.plantLocations &&
        formData.plantLocations.length > 0 ? (
          <div className="flex flex-col gap-md">
            {formData.plantLocations.map((loc, idx) => (
              <div
                key={idx}
                className="p-md rounded-lg border border-line bg-surface-muted flex flex-col gap-xs relative"
              >
                {mode === "edit" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                    <div>
                      <label className="text-xs text-fg-muted font-medium">
                        Plant Name
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                        value={loc.name}
                        onChange={(e) => {
                          const locs = [
                            ...(formData.plantLocations || []),
                          ];
                          locs[idx] = {
                            ...locs[idx],
                            name: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            plantLocations: locs,
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-fg-muted font-medium">
                        City / Region
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                        value={loc.city}
                        onChange={(e) => {
                          const locs = [
                            ...(formData.plantLocations || []),
                          ];
                          locs[idx] = {
                            ...locs[idx],
                            city: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            plantLocations: locs,
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-fg-muted font-medium">
                        Site SPOC Name
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                        value={loc.spocName || ""}
                        onChange={(e) => {
                          const locs = [
                            ...(formData.plantLocations || []),
                          ];
                          locs[idx] = {
                            ...locs[idx],
                            spocName: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            plantLocations: locs,
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-fg-muted font-medium">
                        Site SPOC Phone
                      </label>
                      <input
                        type="text"
                        className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                        value={loc.spocPhone || ""}
                        onChange={(e) => {
                          const locs = [
                            ...(formData.plantLocations || []),
                          ];
                          locs[idx] = {
                            ...locs[idx],
                            spocPhone: e.target.value,
                          };
                          setFormData({
                            ...formData,
                            plantLocations: locs,
                          });
                        }}
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end mt-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const locs = (
                            formData.plantLocations || []
                          ).filter((_, i) => i !== idx);
                          setFormData({
                            ...formData,
                            plantLocations: locs,
                          });
                        }}
                      >
                        <span className="text-bad-fg text-xs">
                          Remove Site
                        </span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-fg">
                        {loc.name}
                      </h4>
                      {loc.city && (
                        <Badge tone="neutral">{loc.city}</Badge>
                      )}
                    </div>
                    {loc.address && (
                      <p className="text-xs text-fg-muted">
                        {loc.address}
                      </p>
                    )}
                    {(loc.spocName || loc.spocPhone) && (
                      <div className="text-xs text-fg-muted mt-xs pt-xs border-t border-line flex items-center gap-md">
                        <span>
                          SPOC: <strong>{loc.spocName || "N/A"}</strong>
                        </span>
                        {loc.spocPhone && (
                          <span>Phone: {loc.spocPhone}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">
            No plant sites configured.
          </p>
        )}
      </Card>

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
                      const secs = (
                        formData.customSections || []
                      ).filter((_, i) => i !== idx);
                      setFormData({
                        ...formData,
                        customSections: secs,
                      });
                    }}
                  >
                    <span className="text-bad-fg text-xs">
                      Remove Section
                    </span>
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

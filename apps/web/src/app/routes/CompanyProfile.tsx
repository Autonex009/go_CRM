import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  accountsApi,
  websiteLabel,
  type PlantLocation,
  type CustomSection,
  type ProfileInput,
} from "../accounts/api";
import { ApiError } from "../lib/api";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  Skeleton,
} from "../ui";

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

export default function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const query = useQuery({
    queryKey: ["companyProfile", id],
    queryFn: () => accountsApi.getProfile(id!),
    enabled: !!id,
  });

  const [formData, setFormData] = useState<ProfileInput | null>(null);

  // Sync initial query data into local edit form state
  useEffect(() => {
    if (query.data) {
      const p = query.data;
      setFormData({
        name: p.account.name,
        website: p.account.website,
        industry: p.account.industry,
        phone: p.account.phone,
        notes: p.account.notes,
        ownerUserId: p.account.ownerUserId,
        tagline: p.profile.tagline,
        description: p.profile.description,
        primaryColor: p.profile.primaryColor || "#6366f1",
        bannerUrl: p.profile.bannerUrl,
        plantLocations: p.profile.plantLocations || [],
        aiDetections: p.profile.aiDetections || [],
        hardwareSpecs: p.profile.hardwareSpecs || {},
        amcStatus: p.profile.amcStatus || "none",
        amcStartDate: p.profile.amcStartDate,
        amcEndDate: p.profile.amcEndDate,
        amcValue: p.profile.amcValue || 0,
        customSections: p.profile.customSections || [],
      });
    }
  }, [query.data]);

  const updateMutation = useMutation({
    mutationFn: (data: ProfileInput) => accountsApi.updateProfile(id!, data),
    onSuccess: (updatedPayload) => {
      queryClient.setQueryData(["companyProfile", id], updatedPayload);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setSaveSuccess(true);
      setSaveError(null);
      setTimeout(() => setSaveSuccess(false), 3000);
      setMode("preview");
    },
    onError: (err) => {
      setSaveError(err instanceof ApiError ? err.message : "Failed to update company profile");
    },
  });

  if (query.isPending || !formData) {
    return (
      <div className="flex flex-col gap-lg p-lg">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-lg">
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Company profile not found"}
        </Alert>
        <div className="mt-md">
          <Button variant="secondary" onClick={() => navigate("/accounts")}>
            Back to Accounts
          </Button>
        </div>
      </div>
    );
  }

  const { deals, quotes, invoices, contacts } = query.data;
  const brandColor = formData.primaryColor || "#6366f1";

  const handleSave = () => {
    if (!formData) return;
    updateMutation.mutate(formData);
  };

  return (
    <div className="flex flex-col gap-lg pb-xl">
      {/* Top Header Navigation & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-md border-b border-line pb-md">
        <div className="flex items-center gap-sm">
          <Button variant="ghost" size="sm" onClick={() => navigate("/accounts")} icon="arrowLeft">
            Accounts
          </Button>

          <span className="text-fg-subtle">/</span>
          <h1 className="text-lg font-semibold text-fg">{formData.name}</h1>
        </div>

        <div className="flex items-center gap-sm">
          {saveSuccess && (
            <span className="text-xs font-medium text-good-fg bg-good-bg px-sm py-xs rounded-md">
              Profile Saved Successfully
            </span>
          )}
          {mode === "edit" ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (query.data) {
                    const p = query.data;
                    setFormData({
                      name: p.account.name,
                      website: p.account.website,
                      industry: p.account.industry,
                      phone: p.account.phone,
                      notes: p.account.notes,
                      ownerUserId: p.account.ownerUserId,
                      tagline: p.profile.tagline,
                      description: p.profile.description,
                      primaryColor: p.profile.primaryColor || "#6366f1",
                      bannerUrl: p.profile.bannerUrl,
                      plantLocations: p.profile.plantLocations || [],
                      aiDetections: p.profile.aiDetections || [],
                      hardwareSpecs: p.profile.hardwareSpecs || {},
                      amcStatus: p.profile.amcStatus || "none",
                      amcStartDate: p.profile.amcStartDate,
                      amcEndDate: p.profile.amcEndDate,
                      amcValue: p.profile.amcValue || 0,
                      customSections: p.profile.customSections || [],
                    });
                  }
                  setMode("preview");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon="edit"
              onClick={() => setMode("edit")}
            >
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {saveError && <Alert>{saveError}</Alert>}

      {/* Hero Banner Section */}
      <div
        className="relative overflow-hidden rounded-xl border border-line p-lg transition-all"
        style={{
          background: `linear-gradient(135deg, ${brandColor}15 0%, ${brandColor}05 100%)`,
          borderColor: `${brandColor}40`,
        }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-md">
          <div className="flex items-center gap-md">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              {formData.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              {mode === "edit" ? (
                <div className="flex flex-col gap-xs">
                  <input
                    type="text"
                    className="text-xl font-bold text-fg bg-surface border border-line rounded px-sm py-xs"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Company Tagline (e.g., Leading Industrial Manufacturer)"
                    className="text-xs text-fg-muted bg-surface border border-line rounded px-sm py-xs w-full md:w-80"
                    value={formData.tagline || ""}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-fg">{formData.name}</h2>
                  {formData.tagline && (
                    <p className="text-sm font-medium text-fg-muted mt-xs">{formData.tagline}</p>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center gap-sm mt-sm text-xs text-fg-muted">
                {formData.industry && (
                  <span className="flex items-center gap-xs bg-surface-muted px-sm py-0.5 rounded-full">
                    <Icon name="building" size={12} />
                    {formData.industry}
                  </span>
                )}
                {formData.website && (
                  <a
                    href={formData.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-xs text-brand hover:underline bg-surface-muted px-sm py-0.5 rounded-full"
                  >
                    <Icon name="globe" size={12} />
                    {websiteLabel(formData.website)}
                  </a>
                )}
                {formData.phone && (
                  <span className="flex items-center gap-xs bg-surface-muted px-sm py-0.5 rounded-full">
                    <Icon name="phone" size={12} />
                    {formData.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* AMC Status Card */}
          <div className="flex items-center gap-md bg-surface p-md rounded-lg border border-line shadow-xs min-w-[240px]">
            <div className="flex flex-col gap-xs w-full">
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>VIGIL AMC Status</span>
                <Badge
                  tone={
                    formData.amcStatus === "active"
                      ? "success"
                      : formData.amcStatus === "pending_renewal"
                      ? "warning"
                      : formData.amcStatus === "expired"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {(formData.amcStatus || "NONE").toUpperCase()}
                </Badge>
              </div>

              {mode === "edit" ? (
                <div className="flex flex-col gap-xs mt-xs">
                  <select
                    className="text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                    value={formData.amcStatus || "none"}
                    onChange={(e) => setFormData({ ...formData, amcStatus: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="pending_renewal">Pending Renewal</option>
                    <option value="expired">Expired</option>
                    <option value="none">None</option>
                  </select>
                  <input
                    type="number"
                    placeholder="AMC Value ($)"
                    className="text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                    value={formData.amcValue || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, amcValue: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              ) : (
                <div className="text-sm font-semibold text-fg">
                  {formData.amcValue ? `$${formData.amcValue.toLocaleString()}` : "N/A"}
                  {formData.amcEndDate && (
                    <span className="block text-xs font-normal text-fg-muted">
                      Renews: {formData.amcEndDate}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Color Theme Selector in Edit Mode */}
        {mode === "edit" && (
          <div className="mt-md pt-md border-t border-line flex items-center gap-md">
            <span className="text-xs text-fg-muted font-medium">Brand Accent Color:</span>
            <div className="flex items-center gap-xs">
              {["#6366f1", "#0b6bcb", "#059669", "#d97706", "#dc2626", "#7c3aed"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    formData.primaryColor === c ? "scale-110 border-fg" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFormData({ ...formData, primaryColor: c })}
                />
              ))}
              <input
                type="color"
                value={formData.primaryColor || "#6366f1"}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Overview & VIGIL Tech Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        {/* Left Column: Description & Plant Sites */}
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
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            ) : (
              <p className="text-sm text-fg-muted leading-relaxed">
                {formData.description || "No company description provided yet."}
              </p>
            )}
          </Card>

          {/* VIGIL AI Detections Module */}
          <Card>
            <CardHeader title="Active VIGIL AI Detection Modules" className="mb-md" />
            {mode === "edit" ? (
              <div className="flex flex-col gap-sm">
                <p className="text-xs text-fg-muted">Select AI detection models deployed at company sites:</p>
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
                  <span className="text-xs text-fg-subtle">No active AI detection modules assigned.</span>
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
                          { name: "New Plant", city: "", address: "", spocName: "", spocPhone: "" },
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
            {formData.plantLocations && formData.plantLocations.length > 0 ? (
              <div className="flex flex-col gap-md">
                {formData.plantLocations.map((loc, idx) => (
                  <div
                    key={idx}
                    className="p-md rounded-lg border border-line bg-surface-muted flex flex-col gap-xs relative"
                  >
                    {mode === "edit" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                        <div>
                          <label className="text-xs text-fg-muted font-medium">Plant Name</label>
                          <input
                            type="text"
                            className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                            value={loc.name}
                            onChange={(e) => {
                              const locs = [...(formData.plantLocations || [])];
                              locs[idx] = { ...locs[idx], name: e.target.value };
                              setFormData({ ...formData, plantLocations: locs });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-fg-muted font-medium">City / Region</label>
                          <input
                            type="text"
                            className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                            value={loc.city}
                            onChange={(e) => {
                              const locs = [...(formData.plantLocations || [])];
                              locs[idx] = { ...locs[idx], city: e.target.value };
                              setFormData({ ...formData, plantLocations: locs });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-fg-muted font-medium">Site SPOC Name</label>
                          <input
                            type="text"
                            className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                            value={loc.spocName || ""}
                            onChange={(e) => {
                              const locs = [...(formData.plantLocations || [])];
                              locs[idx] = { ...locs[idx], spocName: e.target.value };
                              setFormData({ ...formData, plantLocations: locs });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-fg-muted font-medium">Site SPOC Phone</label>
                          <input
                            type="text"
                            className="w-full text-xs bg-surface border border-line rounded px-xs py-xs text-fg"
                            value={loc.spocPhone || ""}
                            onChange={(e) => {
                              const locs = [...(formData.plantLocations || [])];
                              locs[idx] = { ...locs[idx], spocPhone: e.target.value };
                              setFormData({ ...formData, plantLocations: locs });
                            }}
                          />
                        </div>
                        <div className="md:col-span-2 flex justify-end mt-xs">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const locs = (formData.plantLocations || []).filter((_, i) => i !== idx);
                              setFormData({ ...formData, plantLocations: locs });
                            }}
                          >
                            <span className="text-bad-fg text-xs">Remove Site</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-fg">{loc.name}</h4>
                          {loc.city && <Badge tone="neutral">{loc.city}</Badge>}
                        </div>
                        {loc.address && <p className="text-xs text-fg-muted">{loc.address}</p>}
                        {(loc.spocName || loc.spocPhone) && (
                          <div className="text-xs text-fg-muted mt-xs pt-xs border-t border-line flex items-center gap-md">
                            <span>SPOC: <strong>{loc.spocName || "N/A"}</strong></span>
                            {loc.spocPhone && <span>Phone: {loc.spocPhone}</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg-subtle">No plant sites configured.</p>
            )}
          </Card>

          {/* Custom Sections Builder */}
          {formData.customSections && formData.customSections.map((sec, idx) => (
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
                      secs[idx] = { ...secs[idx], content: e.target.value };
                      setFormData({ ...formData, customSections: secs });
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const secs = (formData.customSections || []).filter((_, i) => i !== idx);
                        setFormData({ ...formData, customSections: secs });
                      }}
                    >
                      <span className="text-bad-fg text-xs">Remove Section</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-fg-muted whitespace-pre-wrap">{sec.content}</p>
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

        {/* Right Column: Hardware Specs, Linked Deals, Commercials, Contacts */}
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
                        hardwareSpecs: { ...formData.hardwareSpecs, edgeProcessor: e.target.value },
                      })
                    }
                  />
                ) : (
                  <span className="font-medium text-fg">{formData.hardwareSpecs?.edgeProcessor || "N/A"}</span>
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
                  <span className="font-medium text-fg">{formData.hardwareSpecs?.cameraCount || 0} Streams</span>
                )}
              </div>
              <div className="flex justify-between items-center py-xs border-b border-line">
                <span className="text-fg-muted">Audio / Speaker Units:</span>
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
                  <span className="font-medium text-fg">{formData.hardwareSpecs?.speakerCount || 0} Units</span>
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
                        hardwareSpecs: { ...formData.hardwareSpecs, nvrMake: e.target.value },
                      })
                    }
                  />
                ) : (
                  <span className="font-medium text-fg">{formData.hardwareSpecs?.nvrMake || "N/A"}</span>
                )}
              </div>
            </div>
          </Card>

          {/* Linked Deals */}
          <Card>
            <CardHeader title={`Active Deals (${deals.length})`} className="mb-md" />
            {deals.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {deals.map((deal) => (
                  <div key={deal.id} className="p-sm rounded-md border border-line bg-surface-muted text-xs flex flex-col gap-xs">
                    <div className="flex justify-between font-medium text-fg">
                      <span>{deal.title}</span>
                      <span>${deal.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-fg-muted">
                      <span>Stage: {deal.stage}</span>
                      {deal.siteAssessmentDate && <span>Site Audit: {deal.siteAssessmentDate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg-subtle">No active deals for this company.</p>
            )}
          </Card>

          {/* Quotes & Proposals */}
          <Card>
            <CardHeader title={`Quotes & Proposals (${quotes.length})`} className="mb-md" />
            {quotes.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {quotes.map((quote) => (
                  <div key={quote.id} className="p-sm rounded-md border border-line bg-surface-muted text-xs flex justify-between items-center">
                    <div>
                      <span className="font-medium text-fg block">{quote.number || "Quote"}</span>
                      <span className="text-fg-muted">Status: {quote.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-fg block">${quote.total.toLocaleString()}</span>
                      <Link to={`/quotes/${quote.id}/preview`} className="text-brand hover:underline text-[11px]">
                        View Quote →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg-subtle">No quotes issued yet.</p>
            )}
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader title={`Invoices & Billing (${invoices.length})`} className="mb-md" />
            {invoices.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-sm rounded-md border border-line bg-surface-muted text-xs flex justify-between items-center">
                    <div>
                      <span className="font-medium text-fg block">{inv.invoiceNumber || inv.title || "Invoice"}</span>
                      <span className="text-fg-muted">Status: {inv.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-fg block">${inv.total.toLocaleString()}</span>
                      <Link to={`/invoices/${inv.id}/preview`} className="text-brand hover:underline text-[11px]">
                        View Invoice →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg-subtle">No invoices issued yet.</p>
            )}
          </Card>

          {/* Key Contacts */}
          <Card>
            <CardHeader title={`Key Contacts (${contacts.length})`} className="mb-md" />
            {contacts.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center gap-sm p-sm rounded-md border border-line bg-surface-muted text-xs">
                    <Avatar name={`${contact.firstName} ${contact.lastName || ""}`} size="xs" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-fg block truncate">
                        {contact.firstName} {contact.lastName || ""}
                      </span>
                      {contact.title && <span className="text-fg-muted block truncate">{contact.title}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg-subtle">No contacts linked yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

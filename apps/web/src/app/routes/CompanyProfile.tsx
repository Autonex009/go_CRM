import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  accountsApi,
  websiteLabel,
  type ProfileInput,
  type LinkedDeal,
} from "../accounts/api";
import { DealDialog } from "../deals/DealDialog";
import { dealsApi, type Deal, type DealInput } from "../deals/api";
import { FinancialsTab } from "../accounts/profile/FinancialsTab";
import { LeadsTab } from "../accounts/profile/LeadsTab";
import { OverviewTab } from "../accounts/profile/OverviewTab";
import { PipelineTab } from "../accounts/profile/PipelineTab";
import type { ProfileTab } from "../accounts/profile/tabs";
import { normalizeDealStage } from "../deals/stages";
import { ApiError } from "../lib/api";
import {
  Alert,
  Badge,
  Button,
  Icon,
  Skeleton,
} from "../ui";

export default function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

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
      setSaveError(
        err instanceof ApiError
          ? err.message
          : "Failed to update company profile",
      );
    },
  });

  const [dealToEdit, setDealToEdit] = useState<LinkedDeal | null>(null);

  const updateDealMutation = useMutation({
    mutationFn: ({ dealId, data }: { dealId: string; data: DealInput }) =>
      dealsApi.update(dealId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["companyProfile", id] });
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setDealToEdit(null);
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
          {query.error instanceof ApiError
            ? query.error.message
            : "Company profile not found"}
        </Alert>
        <div className="mt-md">
          <Button variant="secondary" onClick={() => navigate("/accounts")}>
            Back to Accounts
          </Button>
        </div>
      </div>
    );
  }

  const { deals, quotes, invoices, leads } = query.data;
  const brandColor = formData.primaryColor || "#6366f1";

  const totalDealAmount = deals.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Cameras committed across this company's deals. Summed from the deals rather
  // than stored on the account: a client buys in rounds, and one number on the
  // account would lose which deal committed to what.
  const totalCameras = deals.reduce((sum, d) => sum + (d.totalCameras ?? 0), 0);
  const scopedDeals = deals.filter(
    (d) => typeof d.totalCameras === "number",
  ).length;
  const totalLeadEstimate = leads.reduce((sum, l) => sum + (l.value || 0), 0);

  const linkedToFullDeal = (ld: LinkedDeal): Deal => ({
    id: ld.id,
    title: ld.title,
    description: "",
    remark: ld.remark,
    amount: ld.amount,
    stage: normalizeDealStage(ld.stage),
    ownerUserId: formData?.ownerUserId || null,
    ownerName: null,
    ownerEmail: null,
    contactId: null,
    contactName: null,
    accountId: id || null,
    // Carried through, not defaulted: the dialog saves the whole deal, so a
    // field missing here would be written back as empty.
    leadId: ld.leadId,
    totalCameras: ld.totalCameras,
    location: ld.location,
    products: ld.products,
    expectedCloseDate: ld.expectedCloseDate,
    position: 0,
    createdAt: ld.createdAt,
    updatedAt: ld.createdAt,
  });

  const handleSave = () => {
    if (!formData) return;
    updateMutation.mutate(formData);
  };

  return (
    <div className="flex flex-col gap-lg pb-xl">
      {/* Top Header Navigation & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-md border-b border-line pb-md">
        <div className="flex items-center gap-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/accounts")}
            icon="arrowLeft"
          >
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
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="edit"
                onClick={() => setMode("edit")}
              >
                Edit Profile
              </Button>
            </>
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
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Company Tagline (e.g., Leading Industrial Manufacturer)"
                    className="text-xs text-fg-muted bg-surface border border-line rounded px-sm py-xs w-full md:w-80"
                    value={formData.tagline || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, tagline: e.target.value })
                    }
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-fg">
                    {formData.name}
                  </h2>
                  {formData.tagline && (
                    <p className="text-sm font-medium text-fg-muted mt-xs">
                      {formData.tagline}
                    </p>
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
                    onChange={(e) =>
                      setFormData({ ...formData, amcStatus: e.target.value })
                    }
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
                      setFormData({
                        ...formData,
                        amcValue: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              ) : (
                <div className="text-sm font-semibold text-fg">
                  {formData.amcValue
                    ? `$${formData.amcValue.toLocaleString()}`
                    : "N/A"}
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
            <span className="text-xs text-fg-muted font-medium">
              Brand Accent Color:
            </span>
            <div className="flex items-center gap-xs">
              {[
                "#6366f1",
                "#0b6bcb",
                "#059669",
                "#d97706",
                "#dc2626",
                "#7c3aed",
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    formData.primaryColor === c
                      ? "scale-110 border-fg"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setFormData({ ...formData, primaryColor: c })}
                />
              ))}
              <input
                type="color"
                value={formData.primaryColor || "#6366f1"}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                className="h-6 w-6 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-md border-b border-line px-sm overflow-x-auto">
        {(
          [
            { id: "overview", label: "Overview", count: null },
            {
              id: "pipeline",
              label: "Pipeline & Deals",
              count: deals.length + leads.length,
            },
            {
              id: "leads",
              label: "Leads",
              count: leads.length,
            },
            {
              id: "financials",
              label: "Financials",
              count: quotes.length + invoices.length,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-sm py-sm text-sm font-medium border-b-2 transition-colors flex items-center gap-xs ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-fg-muted hover:text-fg hover:border-line"
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? "bg-brand/15 text-brand"
                    : "bg-surface-muted text-fg-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          accountId={id!}
          mode={mode}
          formData={formData}
          setFormData={setFormData}
          deals={deals}
          leads={leads}
          quotes={quotes}
          invoices={invoices}
          totalDealAmount={totalDealAmount}
          totalCameras={totalCameras}
          scopedDeals={scopedDeals}
          totalLeadEstimate={totalLeadEstimate}
          onEditDeal={setDealToEdit}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === "pipeline" && (
        <PipelineTab
          deals={deals}
          leads={leads}
          totalDealAmount={totalDealAmount}
          totalLeadEstimate={totalLeadEstimate}
          onEditDeal={setDealToEdit}
        />
      )}

      {activeTab === "financials" && (
        <FinancialsTab quotes={quotes} invoices={invoices} />
      )}

      {activeTab === "leads" && <LeadsTab leads={leads} />}

      {/* Editing a linked deal only. Deals and leads are created on their own
          pages, so the profile stays a view of what already exists. */}
      {dealToEdit && (
        <DealDialog
          deal={linkedToFullDeal(dealToEdit)}
          defaultStage={normalizeDealStage(dealToEdit.stage)}
          onClose={() => setDealToEdit(null)}
          onSubmit={async (input) => {
            await updateDealMutation.mutateAsync({
              dealId: dealToEdit.id,
              data: input,
            });
          }}
        />
      )}
    </div>
  );
}

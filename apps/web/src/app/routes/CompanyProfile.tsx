import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  accountsApi,
  websiteLabel,
  type ProfileInput,
} from "../accounts/api";
import { FinancialsTab } from "../accounts/profile/FinancialsTab";
import { LeadsTab } from "../accounts/profile/LeadsTab";
import { OverviewTab } from "../accounts/profile/OverviewTab";
import { PipelineTab } from "../accounts/profile/PipelineTab";
import { SpecList } from "../accounts/profile/SpecList";
import { humanise } from "../accounts/profile/columns";
import { formatDay } from "../accounts/profile/format";
import { computeMetrics } from "../accounts/profile/metrics";
import type { ProfileTab } from "../accounts/profile/tabs";
import { ApiError } from "../lib/api";
import { formatMoney } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { Alert, Badge, Button, Icon, Skeleton } from "../ui";

/** AMC status → badge tone, so the header reads at a glance. */
const AMC_TONE = {
  active: "success",
  pending_renewal: "warning",
  expired: "danger",
  none: "neutral",
} as const;

export default function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currency = useCurrency();

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
      setFormData(toForm(query.data));
    }
  }, [query.data]);

  /**
   * Every figure the page shows, summed once here.
   *
   * The tabs used to each total the same deal list themselves, which is how the
   * Overview and the Pipeline came to print different numbers for one company.
   */
  const payload = query.data;
  const metrics = useMemo(
    () =>
      computeMetrics(
        payload?.deals ?? [],
        payload?.leads ?? [],
        payload?.quotes ?? [],
        payload?.invoices ?? [],
      ),
    [payload],
  );

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

  const { account, deals, quotes, invoices, leads, contacts } = query.data;
  const brandColor = formData.primaryColor || "#6366f1";
  const amcStatus = (formData.amcStatus || "none") as keyof typeof AMC_TONE;

  const handleSave = () => {
    if (!formData) return;
    updateMutation.mutate(formData);
  };

  return (
    <div className="flex flex-col gap-lg pb-xl">
      {/* Breadcrumb and the one editor on the page: the company's own profile.
          Its deals, leads and documents are read-only here — each has a page of
          its own, and a second editor for the same row is how the two drift. */}
      <div className="flex flex-wrap items-center justify-between gap-md border-b border-line pb-md">
        <div className="flex min-w-0 items-center gap-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/accounts")}
            icon="arrowLeft"
          >
            Accounts
          </Button>
          <span className="text-fg-subtle">/</span>
          <h1 className="truncate text-lg font-semibold text-fg">
            {formData.name}
          </h1>
        </div>

        <div className="flex items-center gap-sm">
          {saveSuccess && (
            <span className="rounded-md bg-ok-soft px-sm py-xs text-xs font-medium text-ok-fg">
              Profile saved
            </span>
          )}
          {mode === "edit" ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (query.data) setFormData(toForm(query.data));
                  setSaveError(null);
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
                {updateMutation.isPending ? "Saving..." : "Save profile"}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon="edit"
              onClick={() => setMode("edit")}
            >
              Edit profile
            </Button>
          )}
        </div>
      </div>

      {saveError && <Alert>{saveError}</Alert>}

      {/* Identity header */}
      <div
        className="relative overflow-hidden rounded-lg border p-lg"
        style={{
          background: `linear-gradient(135deg, ${brandColor}14 0%, ${brandColor}05 100%)`,
          borderColor: `${brandColor}40`,
        }}
      >
        <div className="flex flex-col gap-lg lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-md">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-xl font-bold text-white shadow-sm"
              style={{ backgroundColor: brandColor }}
            >
              {formData.name.slice(0, 2).toUpperCase()}
            </div>

            <div className="min-w-0">
              {mode === "edit" ? (
                <div className="flex flex-col gap-xs">
                  <input
                    type="text"
                    className="rounded-md border border-line bg-surface px-sm py-xs text-xl font-bold text-fg"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Company tagline (e.g. Leading industrial manufacturer)"
                    className="w-full rounded-md border border-line bg-surface px-sm py-xs text-xs text-fg-muted md:w-80"
                    value={formData.tagline || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, tagline: e.target.value })
                    }
                  />
                </div>
              ) : (
                <>
                  <h2 className="truncate text-2xl font-bold tracking-[-0.01em] text-fg">
                    {formData.name}
                  </h2>
                  {formData.tagline && (
                    <p className="mt-xs text-sm text-fg-muted">
                      {formData.tagline}
                    </p>
                  )}
                </>
              )}

              <div className="mt-sm flex flex-wrap items-center gap-sm text-xs text-fg-muted">
                {formData.industry && (
                  <span className="flex items-center gap-xs rounded-full bg-surface px-sm py-0.5">
                    <Icon name="building" size={12} />
                    {formData.industry}
                  </span>
                )}
                {formData.website && (
                  <a
                    href={formData.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-xs rounded-full bg-surface px-sm py-0.5 text-accent hover:underline"
                  >
                    <Icon name="globe" size={12} />
                    {websiteLabel(formData.website)}
                  </a>
                )}
                {formData.phone && (
                  <span className="flex items-center gap-xs rounded-full bg-surface px-sm py-0.5">
                    <Icon name="phone" size={12} />
                    {formData.phone}
                  </span>
                )}
                {account.ownerName && (
                  <span className="flex items-center gap-xs rounded-full bg-surface px-sm py-0.5">
                    <Icon name="team" size={12} />
                    {account.ownerName}
                  </span>
                )}
                <span className="flex items-center gap-xs rounded-full bg-surface px-sm py-0.5">
                  <Icon name="dashboard" size={12} />
                  Client since {formatDay(account.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* AMC contract panel */}
          <div className="w-full shrink-0 rounded-lg border border-line bg-surface p-md shadow-sm lg:w-[300px]">
            <div className="flex items-center justify-between gap-sm">
              <span className="text-xs font-medium text-fg-muted">
                VIGIL AMC contract
              </span>
              <Badge tone={AMC_TONE[amcStatus] ?? "neutral"} dot>
                {humanise(amcStatus)}
              </Badge>
            </div>

            {mode === "edit" ? (
              <div className="mt-sm flex flex-col gap-xs">
                <select
                  className="rounded-md border border-line bg-surface px-xs py-xs text-xs text-fg"
                  value={formData.amcStatus || "none"}
                  onChange={(e) =>
                    setFormData({ ...formData, amcStatus: e.target.value })
                  }
                >
                  <option value="active">Active</option>
                  <option value="pending_renewal">Pending renewal</option>
                  <option value="expired">Expired</option>
                  <option value="none">None</option>
                </select>
                <input
                  type="number"
                  placeholder={`AMC value (${currency})`}
                  className="rounded-md border border-line bg-surface px-xs py-xs text-xs text-fg"
                  value={formData.amcValue || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amcValue: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-xs">
                  <label className="flex flex-col gap-0.5 text-[11px] text-fg-muted">
                    Starts
                    <input
                      type="date"
                      className="rounded-md border border-line bg-surface px-xs py-xs text-xs text-fg"
                      value={formData.amcStartDate?.slice(0, 10) || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amcStartDate: e.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[11px] text-fg-muted">
                    Renews
                    <input
                      type="date"
                      className="rounded-md border border-line bg-surface px-xs py-xs text-xs text-fg"
                      value={formData.amcEndDate?.slice(0, 10) || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amcEndDate: e.target.value || null,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : (
              <SpecList
                className="mt-sm"
                columns={2}
                items={[
                  {
                    label: "Contract value",
                    value: formData.amcValue
                      ? formatMoney(formData.amcValue, currency)
                      : "—",
                  },
                  {
                    label: "Renews",
                    value: formatDay(formData.amcEndDate),
                    note: formData.amcStartDate
                      ? `from ${formatDay(formData.amcStartDate)}`
                      : undefined,
                  },
                ]}
              />
            )}
          </div>
        </div>

        {/* Brand accent, edit mode only */}
        {mode === "edit" && (
          <div className="mt-md flex items-center gap-md border-t border-line pt-md">
            <span className="text-xs font-medium text-fg-muted">
              Brand accent colour
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
                  aria-label={`Use ${c}`}
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
                aria-label="Custom brand colour"
                value={formData.primaryColor || "#6366f1"}
                onChange={(e) =>
                  setFormData({ ...formData, primaryColor: e.target.value })
                }
                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-md overflow-x-auto border-b border-line px-sm">
        {(
          [
            { id: "overview", label: "Overview", count: null },
            { id: "pipeline", label: "Pipeline & deals", count: deals.length },
            { id: "leads", label: "Leads", count: leads.length },
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
            className={`flex items-center gap-xs border-b-2 px-sm py-sm text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-fg-muted hover:border-line hover:text-fg"
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  activeTab === tab.id
                    ? "bg-accent-soft text-accent"
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
          contacts={contacts}
          metrics={metrics}
          currency={currency}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === "pipeline" && (
        <PipelineTab
          deals={deals}
          leads={leads}
          metrics={metrics}
          currency={currency}
        />
      )}

      {activeTab === "leads" && <LeadsTab leads={leads} currency={currency} />}

      {activeTab === "financials" && (
        <FinancialsTab
          quotes={quotes}
          invoices={invoices}
          metrics={metrics}
          currency={currency}
        />
      )}
    </div>
  );
}

/**
 * The server payload as the edit form sees it.
 *
 * Shared by the initial load and Cancel so the two cannot fall out of step — the
 * page previously spelled this object out twice, and a field added to one copy
 * would silently not be restorable by the other.
 */
function toForm(
  payload: Awaited<ReturnType<typeof accountsApi.getProfile>>,
): ProfileInput {
  const { account, profile } = payload;
  return {
    name: account.name,
    website: account.website,
    industry: account.industry,
    phone: account.phone,
    notes: account.notes,
    ownerUserId: account.ownerUserId,
    tagline: profile.tagline,
    description: profile.description,
    primaryColor: profile.primaryColor || "#6366f1",
    bannerUrl: profile.bannerUrl,
    plantLocations: profile.plantLocations || [],
    aiDetections: profile.aiDetections || [],
    hardwareSpecs: profile.hardwareSpecs || {},
    amcStatus: profile.amcStatus || "none",
    amcStartDate: profile.amcStartDate,
    amcEndDate: profile.amcEndDate,
    amcValue: profile.amcValue || 0,
    customSections: profile.customSections || [],
  };
}

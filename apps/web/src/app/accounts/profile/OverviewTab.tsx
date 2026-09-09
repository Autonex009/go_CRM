import type {
  LinkedDeal,
  LinkedInvoice,
  LinkedLead,
  LinkedQuote,
  ProfileInput,
} from "../api";
import { MetricsBanner } from "./MetricsBanner";
import { ProfileDetails } from "./ProfileDetails";
import { ProfileSidebar } from "./ProfileSidebar";
import { SnapshotCards } from "./SnapshotCards";
import type { ProfileTab } from "./tabs";

/**
 * The Overview tab: the company itself, plus a summary of what hangs off it.
 *
 * Composed of four sections rather than written inline, split along the line
 * that actually matters — the top two read the linked deals, leads and
 * documents, the bottom two read the edit form. Editing a plant address
 * re-renders only the column it is in.
 *
 * This is also the only tab that edits. Each section renders in both preview
 * and edit mode and switches its own fields on `mode`, so the two views cannot
 * drift into showing different things.
 */
export function OverviewTab({
  accountId,
  mode,
  formData,
  setFormData,
  deals,
  leads,
  quotes,
  invoices,
  totalDealAmount,
  totalCameras,
  scopedDeals,
  totalLeadEstimate,
  onEditDeal,
  setActiveTab,
}: {
  accountId: string;
  mode: "preview" | "edit";
  formData: ProfileInput;
  setFormData: (next: ProfileInput) => void;
  deals: LinkedDeal[];
  leads: LinkedLead[];
  quotes: LinkedQuote[];
  invoices: LinkedInvoice[];
  totalDealAmount: number;
  totalCameras: number;
  /** How many deals actually carry a camera count, so a partial total can say so. */
  scopedDeals: number;
  totalLeadEstimate: number;
  onEditDeal: (deal: LinkedDeal) => void;
  /** The metric cards double as navigation into the tab that details them. */
  setActiveTab: (tab: ProfileTab) => void;
}) {
  return (
    <div className="flex flex-col gap-lg mt-md">
      <MetricsBanner
        deals={deals}
        leads={leads}
        quotes={quotes}
        invoices={invoices}
        totalDealAmount={totalDealAmount}
        totalCameras={totalCameras}
        scopedDeals={scopedDeals}
        totalLeadEstimate={totalLeadEstimate}
        setActiveTab={setActiveTab}
      />

      <SnapshotCards
        deals={deals}
        leads={leads}
        setActiveTab={setActiveTab}
        onEditDeal={onEditDeal}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        <ProfileDetails
          mode={mode}
          formData={formData}
          setFormData={setFormData}
        />
        <ProfileSidebar
          accountId={accountId}
          mode={mode}
          formData={formData}
          setFormData={setFormData}
        />
      </div>
    </div>
  );
}

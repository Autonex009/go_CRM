import type {
  LinkedContact,
  LinkedDeal,
  LinkedLead,
  ProfileInput,
} from "../api";
import { MetricsBanner } from "./MetricsBanner";
import { ProfileDetails } from "./ProfileDetails";
import { ProfileSidebar } from "./ProfileSidebar";
import { SnapshotCards } from "./SnapshotCards";
import type { ProfileMetrics } from "./metrics";
import type { ProfileTab } from "./tabs";

/**
 * The Overview tab: the company itself, plus a summary of what hangs off it.
 *
 * Composed of four sections rather than written inline, split along the line
 * that actually matters — the top two read the linked deals, leads and
 * documents, the bottom two read the edit form. Editing a plant address
 * re-renders only the column it is in.
 *
 * This is also the only tab that edits, and only the company's own profile
 * fields. The linked records are reported on, never authored here: they each
 * have a page of their own, and two editors for one row is how the two come to
 * disagree.
 */
export function OverviewTab({
  accountId,
  mode,
  formData,
  setFormData,
  deals,
  leads,
  contacts,
  metrics,
  currency,
  setActiveTab,
}: {
  accountId: string;
  mode: "preview" | "edit";
  formData: ProfileInput;
  setFormData: (next: ProfileInput) => void;
  deals: LinkedDeal[];
  leads: LinkedLead[];
  contacts: LinkedContact[];
  metrics: ProfileMetrics;
  currency: string;
  /** The metric tiles double as navigation into the tab that details them. */
  setActiveTab: (tab: ProfileTab) => void;
}) {
  return (
    <div className="mt-md flex flex-col gap-lg">
      <MetricsBanner
        metrics={metrics}
        currency={currency}
        setActiveTab={setActiveTab}
      />

      <SnapshotCards
        deals={deals}
        leads={leads}
        currency={currency}
        setActiveTab={setActiveTab}
      />

      <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
        <ProfileDetails
          mode={mode}
          formData={formData}
          setFormData={setFormData}
          metrics={metrics}
        />
        <ProfileSidebar
          accountId={accountId}
          mode={mode}
          formData={formData}
          setFormData={setFormData}
          contacts={contacts}
        />
      </div>
    </div>
  );
}

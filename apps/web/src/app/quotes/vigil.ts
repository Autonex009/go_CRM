/**
 * The Autonex VIGIL techno-commercial proposal template.
 *
 * Source document: docs/Autonex_VIGIL_Technocommercial.pdf.
 *
 * The proposal is fifteen pages of scope, SLA, AMC coverage, prerequisites and
 * acceptance criteria wrapped around the same commercials an ordinary quote
 * carries. Rather than sixteen bespoke section components, a section is one of a
 * handful of *shapes* — prose, a label/value grid, a bullet list, a table, an
 * included/excluded pair, a boxed clause. One editor and one renderer then cover
 * the whole document, and adding a row to any section is typing, not a code
 * change.
 *
 * The commercials are deliberately NOT modelled here. They live in the quote's
 * own line items, so the totals on the quotes list, the company financials and
 * any invoice raised from the quote all keep reading the same numbers. A price
 * duplicated into this document would be the one that goes stale.
 */

import type { QuoteItemInput } from "./api";

/** The template's stored name. Must match quotes.TemplateVigil in Go. */
export const VIGIL_TEMPLATE = "vigil_technocommercial";

/** Company identity, printed on every page. Fixed, not per-proposal. */
export const AUTONEX = {
  legalName: "AUTONEX AI 360 PRIVATE LIMITED",
  cin: "U62099MH2025PTC453218",
  address:
    "908, Lodha Supremus, Saki Vihar Road, Powai - 400072, Maharashtra, India",
} as const;

export type SectionKind =
  | "text"
  | "fields"
  | "bullets"
  | "table"
  | "split"
  | "note";

interface BaseSection {
  /** Stable across edits — it is the React key and the reorder handle. */
  id: string;
  title: string;
  kind: SectionKind;
}

/** A paragraph of prose. */
export interface TextSection extends BaseSection {
  kind: "text";
  body: string;
}

/** A label/value grid — the document's many two-column spec tables. */
export interface FieldsSection extends BaseSection {
  kind: "fields";
  rows: { label: string; value: string }[];
}

/** A checklist. Rendered with a tick, as in the source document. */
export interface BulletsSection extends BaseSection {
  kind: "bullets";
  items: string[];
}

/** A grid with a header row. */
export interface TableSection extends BaseSection {
  kind: "table";
  columns: string[];
  rows: string[][];
}

/** The recurring "Included in scope / Excluded, separately quoted" pair. */
export interface SplitSection extends BaseSection {
  kind: "split";
  leftTitle: string;
  rightTitle: string;
  left: string[];
  right: string[];
}

/** A boxed standard clause — the scope boundaries and SLA caveats. */
export interface NoteSection extends BaseSection {
  kind: "note";
  body: string;
}

export type VigilSection =
  | TextSection
  | FieldsSection
  | BulletsSection
  | TableSection
  | SplitSection
  | NoteSection;

/** The identifying details on page one. */
export interface VigilHeader {
  customerName: string;
  siteName: string;
  quotationNumber: string;
  proposalDate: string;
  validityDays: string;
  cameraCount: string;
  preparedBy: string;
  version: string;
}

/** The whole stored document. Persisted as jsonb on quote_proposals.data. */
export interface VigilProposal {
  header: VigilHeader;
  /** The commercials table's own heading and footnote; the rows are line items. */
  commercialsNote: string;
  sections: VigilSection[];
}

/** Today as YYYY-MM-DD in the local timezone, for the date input. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The commercial lines the document opens with.
 *
 * Per-camera rates with the camera count as the quantity, matching the source
 * document's "Amount per Cam × Qty" tables. They are ordinary quote line items,
 * so the moment a rate is typed the quote's total is right everywhere else in
 * the app.
 */
export function defaultVigilItems(): QuoteItemInput[] {
  return [
    {
      description:
        "One-Time Installation — AI processor (Autonex x NVIDIA), dashboard, " +
        "system integration, on-site setup & consultation",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: 18,
    },
    {
      description:
        "Platform Subscription + AMC (Year 1) — dashboard, evidence storage, " +
        "updates, remote support, quarterly preventive maintenance",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: 18,
    },
    {
      description:
        "Platform Subscription + AMC (Year 2 onwards) — annual recurring",
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxPercent: 18,
    },
  ];
}

/**
 * A fresh proposal, pre-filled with the standard clauses from the source PDF.
 *
 * Everything here is editable per quote. The boilerplate is seeded rather than
 * fixed because it is what changes least, not what never changes — an SLA is
 * negotiated site by site, and a template that could not be edited would be
 * retyped into Word instead.
 */
export function defaultVigilProposal(): VigilProposal {
  return {
    header: {
      customerName: "",
      siteName: "",
      quotationNumber: "AUTX/VIGIL/XXX/MMYY/001",
      proposalDate: today(),
      validityDays: "30",
      cameraCount: "",
      preparedBy: "Autonex AI 360 Pvt Ltd",
      version: "V1",
    },

    commercialsNote:
      "Commercial figures are provided per camera unit. Listed rates are " +
      "exclusive of applicable GST. From Year 2 onwards, only the annual " +
      "recurring cost applies (Platform Subscription + AMC), unless additional " +
      "cameras, detections or hardware are added.",

    sections: [
      {
        id: "solution",
        kind: "text",
        title: "Solution Summary",
        body:
          "VIGIL is Autonex's edge AI-powered industrial vision monitoring " +
          "platform. It runs on the customer's existing CCTV/IP camera " +
          "infrastructure, processing video locally through an on-site edge AI " +
          "processor to detect agreed safety, productivity, and process events " +
          "in real time - without requiring continuous video upload to the cloud.",
      },
      {
        id: "solution-highlights",
        kind: "bullets",
        title: "Why VIGIL",
        items: [
          "Uses existing CCTV/IP camera infrastructure",
          "On-site edge AI inference — low latency, no video upload",
          "Real-time detection of agreed safety / productivity events",
          "Instant alerts via dashboard, speakers and/or email",
          "Image + timestamp-based audit trail for every violation",
          "Centralised dashboard for incident monitoring and analytics",
        ],
      },
      {
        id: "scope",
        kind: "fields",
        title: "Scope of Deployment",
        rows: [
          { label: "Site / plant", value: "" },
          { label: "Number of cameras", value: "" },
          { label: "Number of speakers / buzzers", value: "" },
          { label: "Number of dashboards / users", value: "" },
          {
            label: "Deployment architecture",
            value: "Edge + cloud dashboard",
          },
          { label: "Evidence retention period", value: "30 days" },
          { label: "Internet / network requirement", value: "" },
        ],
      },
      {
        id: "scope-clause",
        kind: "note",
        title: "Standard clause",
        body:
          "Existing CCTV/NVR feed will be utilised subject to RTSP/IP stream " +
          "compatibility and satisfactory camera angle, lighting and image quality.",
      },
      {
        id: "detections",
        kind: "table",
        title: "Features / Detections Included",
        columns: ["Detection", "Status"],
        rows: [
          ["Helmet", "Included"],
          ["Gloves", "Included"],
          ["Face shield", "Optional"],
          ["Reflective jacket", "Included"],
          ["Safety harness", "Optional"],
          ["Mobile phone usage", "Optional"],
          ["Unsafe posture / unsafe act", "Phase 2"],
          ["Restricted-zone intrusion", "Included"],
          ["Worker-machine proximity", "Optional"],
          ["Forklift-pedestrian proximity", "Optional"],
          ["Suspended-load / crane-zone intrusion", "Phase 2"],
          ["Fire / smoke detection where technically applicable", "Optional"],
        ],
      },
      {
        id: "scope-boundary",
        kind: "note",
        title: "Scope boundary",
        body:
          "AI models will be configured / fine-tuned for agreed site conditions. " +
          "New detections outside the agreed scope will be separately scoped and " +
          "commercially quoted.",
      },
      {
        id: "architecture",
        kind: "bullets",
        title: "VIGIL Technology / Architecture",
        items: [
          "Existing CCTV/IP cameras capture video",
          "Streams accessed through NVR / RTSP",
          "VIGIL Edge AI Processor infers locally at the plant",
          "Only detection events / metadata reach the dashboard",
          "Alerts generated in real time",
          "Events recorded in a searchable incident registry",
        ],
      },
      {
        id: "processor",
        kind: "fields",
        title: "AI Processor — Autonex x NVIDIA",
        rows: [
          {
            label: "Included hardware",
            value: "Industrial carrier board, protective enclosure",
          },
          { label: "Software", value: "Autonex AI software stack, pre-configured" },
          {
            label: "Processing",
            value:
              "Local inference — low latency; no continuous CCTV video upload to the cloud",
          },
          {
            label: "Sizing basis",
            value:
              "Camera resolution, FPS, number/complexity of detections, concurrent streams",
          },
        ],
      },
      {
        id: "software",
        kind: "bullets",
        title: "Software / VIGIL Dashboard",
        items: [
          "Centralised VIGIL dashboard",
          "Live streaming of cameras (5 FPS) – if required",
          "Camera / location-wise monitoring",
          "Real-time violation alerts",
          "Incident registry with image evidence & timestamp",
          "Violation category & severity tagging",
          "Searchable historical records",
          "Shift / time-based filtering",
          "Violation trends and analytics",
          "User access / role management",
          "Multi-site visibility, where applicable",
          "Email alerts",
          "Detection configuration / toggles",
        ],
      },
      {
        id: "storage",
        kind: "fields",
        title: "Data Storage",
        rows: [
          { label: "Standard evidence retention", value: "30 days" },
          { label: "What is stored", value: "Violation images + metadata" },
          {
            label: "Continuous video storage",
            value: "Not stored by VIGIL unless separately agreed",
          },
          { label: "Longer retention", value: "Available at additional cost" },
        ],
      },
      {
        id: "alerting",
        kind: "bullets",
        title: "Alerting System",
        items: [
          "Dashboard alerts",
          "On-floor speaker alerts",
          "Email alerts",
          "SMS / WhatsApp - if selected",
          "Zone-specific announcements",
          "Configurable alert logic",
          "Alert frequency / suppression logic, where applicable",
        ],
      },
      {
        id: "alert-hardware",
        kind: "fields",
        title: "Alert Hardware Quantities",
        rows: [
          { label: "Number of speakers", value: "" },
          { label: "Speaker per camera / zone / area", value: "As designed" },
          { label: "Communication mechanism / interface", value: "" },
        ],
      },
      {
        id: "amc-commitments",
        kind: "bullets",
        title: "AMC — Service Commitments",
        items: [
          "1 preventive-maintenance visit per quarter (4/year)",
          "Unlimited remote troubleshooting during the AMC term",
          "Breakdown visits where remote resolution is insufficient",
          "Target restoration: 2 working days (software) / 7 working days (hardware)",
          "Quarterly health report — availability, faults, actions, recommendations",
        ],
      },
      {
        id: "amc-coverage",
        kind: "split",
        title: "AMC — Detailed Scope of Coverage",
        leftTitle: "Included in Scope",
        rightTitle: "Excluded / Separately Quoted",
        left: [
          "VIGIL edge AI processors / GPU units",
          "VIGIL speaker / buzzer / communication hardware (if opted for speakers)",
          "Deployed VIGIL application support, bug fixes & recovery",
          "Existing agreed AI detection tuning / calibration",
          "RTSP / camera-stream troubleshooting up to the VIGIL integration point",
          "Quarterly preventive maintenance visit",
          "Onsite support for VIGIL hardware",
        ],
        right: [
          "CCTV camera repair / replacement for normal wear & tear",
          "NVR health, recording, storage-health checks & repair",
          "PoE switches, media converters, adapters, port health",
          "Minor CCTV cabling, connectors, patch cords",
          "Core IT switches, firewall, routers, ISP / enterprise network",
          "New camera / network expansion or major re-cabling",
          "New AI use cases / detection classes beyond agreed scope",
          "Damage from theft, vandalism, fire, flood, power surge, etc.",
        ],
      },
      {
        id: "pm-checklist",
        kind: "table",
        title: "Preventive-Maintenance Checklist",
        columns: ["Area", "What Is Checked"],
        rows: [
          [
            "VIGIL system",
            "GPU / edge device health, service uptime, temperature / power checks, " +
              "stream stability, inference service, speakers / alerts, dashboard " +
              "connectivity, configuration backup and error-log review.",
          ],
          [
            "Camera feed quality",
            "Feed availability, frame stability, latency, view obstruction and " +
              "suitability for the deployed AI detections.",
          ],
          [
            "Functional test",
            "Sample end-to-end violation test from camera feed to VIGIL detection, " +
              "alert generation and evidence logging for representative cameras.",
          ],
          [
            "Reporting",
            "Service report after each preventive visit, with faults rectified, " +
              "pending issues, excluded / site-side issues and recommended " +
              "corrective actions.",
          ],
        ],
      },
      {
        id: "sla",
        kind: "table",
        title: "Breakdown Support & SLA",
        columns: ["Service Metric", "Commitment", "Notes"],
        rows: [
          [
            "Ticket acknowledgement",
            "Within 4 working hours",
            "Applies to covered incidents logged through the agreed support channel.",
          ],
          [
            "Remote diagnosis",
            "Same working day",
            "Autonex will first attempt remote recovery where safe and technically feasible.",
          ],
          [
            "Onsite attendance",
            "Within 4 working days, where required",
            "Subject to site entry, safety induction, access permissions and travel feasibility.",
          ],
          [
            "Target restoration",
            "2 working days (software); 7 working days (hardware)",
            "Restoration may be through repair, configuration recovery, temporary " +
              "workaround, or compatible standby / replacement.",
          ],
          [
            "Permanent replacement",
            "As per spare / OEM availability",
            "If a component cannot be permanently replaced within the target " +
              "restoration period, Autonex will use a temporary compatible " +
              "substitute where feasible.",
          ],
        ],
      },
      {
        id: "sla-pause",
        kind: "note",
        title: "SLA clock pause conditions",
        body:
          "The SLA clock pauses where resolution is prevented by lack of site " +
          "access, unavailable credentials, upstream power/network outage, " +
          "client-requested change freeze, force majeure, OEM/end-of-life " +
          "procurement constraints, or damage outside AMC coverage.",
      },
      {
        id: "amc-terms",
        kind: "fields",
        title: "AMC Commercial Terms",
        rows: [
          { label: "AMC term", value: "12 months, renewable annually" },
          {
            label: "Billing",
            value:
              "AMC invoice raised at the start of each annual AMC period, unless " +
              "otherwise agreed in the central PO",
          },
          { label: "Taxes", value: "Rates exclusive of applicable GST" },
          {
            label: "Quantity basis",
            value:
              "Annual AMC value = agreed rate per camera × number of cameras " +
              "admitted into the AMC asset register",
          },
          {
            label: "Rate validity",
            value:
              "Rates apply for the contracted 12-month period; renewal rates may " +
              "be reviewed for material OEM/inflationary changes",
          },
          {
            label: "Scope changes",
            value:
              "Addition of cameras/assets during the year charged on a mutually " +
              "agreed pro-rata basis from the date they enter AMC coverage",
          },
        ],
      },
      {
        id: "client-responsibilities",
        kind: "bullets",
        title: "Client-Side Responsibilities",
        items: [
          "Provide safe and timely site access, permits, escort and any mandatory induction/PPE required for maintenance work",
          "Maintain stable power and required site/network connectivity; provide authorised access credentials to cameras/NVR/network devices where applicable",
          "Notify Autonex before changes to CCTV IPs, passwords, NVR configuration, network topology or relevant IT policies",
          "Provide a nominated site SPOC for incident logging, access coordination and service-report acknowledgement",
          "Ensure equipment remains installed and operated within manufacturer/environmental specifications",
        ],
      },
      {
        id: "support",
        kind: "split",
        title: "Software Support / Platform Subscription",
        leftTitle: "Included in Scope",
        rightTitle: "Excluded / Separately Quoted",
        left: [
          "Dashboard access",
          "Remote software support",
          "Bug fixes",
          "Software & dashboard upgrades",
          "Security patches",
          "Model monitoring",
          "Model tuning for existing agreed detections",
          "Incident / issue resolution",
          "Standard evidence storage",
          "User support",
        ],
        right: [
          "Completely new AI detections",
          "New plants / cameras",
          "ERP / SAP integrations",
          "Major new dashboard modules",
          "Custom reporting",
          "Additional storage",
          "SMS / WhatsApp consumption",
        ],
      },
      {
        id: "implementation",
        kind: "bullets",
        title: "Implementation & Delivery Plan",
        items: [
          "Site survey & camera assessment",
          "Network / RTSP validation",
          "Hardware procurement",
          "Edge processor installation",
          "Camera + speaker onboarding",
          "AI model configuration / tuning (if needed)",
          "Dashboard configuration",
          "Testing & UAT",
          "Operator training",
          "Go-live & stabilisation",
        ],
      },
      {
        id: "timeline",
        kind: "fields",
        title: "Indicative Timeline",
        rows: [
          { label: "Hardware delivery", value: "weeks after PO" },
          { label: "Installation", value: "days" },
          { label: "Stabilisation / tuning", value: "First 2–4 weeks after go-live" },
        ],
      },
      {
        id: "prereq-cameras",
        kind: "bullets",
        title: "Prerequisites — Camera & Video Infrastructure",
        items: [
          "Cameras are IP cameras (not analog DVR-based)",
          "Cameras connected via Ethernet (PoE preferred)",
          "Camera resolution minimum 1080p (Full HD)",
          "Night visibility / lighting adequate for monitoring area",
          "Camera coverage clearly captures required zones (PPE / machines / entry points)",
          "RTSP-compatible NVR / camera access, with credentials",
        ],
      },
      {
        id: "prereq-network",
        kind: "bullets",
        title: "Prerequisites — Network & Connectivity",
        items: [
          "Ethernet ports available near camera locations",
          "Network switches within 2–7 m of camera/speaker points with sufficient bandwidth",
          "Stable LAN network (no frequent downtime)",
          "Access to central NVR / network room, if applicable",
          "NVR make & model, and IP access / credentials, available",
          "Internet access available where a cloud dashboard is used",
        ],
      },
      {
        id: "prereq-speakers",
        kind: "bullets",
        title: "Prerequisites — Speaker Installation",
        items: [
          "Installation points identified near key monitoring zones",
          "Mounting provision available (M6 / M7 bolts)",
          "Power source available near speaker location",
          "Speaker-to-network-point distance measured (within 2–7 m)",
          "Clear audible coverage of target area confirmed",
        ],
      },
      {
        id: "prereq-processor",
        kind: "bullets",
        title: "Prerequisites — AI Processor (Edge Device) Setup",
        items: [
          "Dedicated space available for the AI box (edge processor)",
          "Location is dust-free and air-conditioned / well-ventilated",
          "Continuous power supply available (UPS preferred)",
          "Ethernet connection available at the installation point",
          "Rack / table / mounting surface available",
        ],
      },
      {
        id: "prereq-access",
        kind: "bullets",
        title: "Prerequisites — Cabling, Access & Permissions",
        items: [
          "Cable routing paths already exist (to check with CCTV provider)",
          "Additional Ethernet cables available, if needed",
          "Cable lengths estimated for all endpoints",
          "IT / network team available during installation",
          "Camera / NVR access credentials ready",
          "Permission to connect to the internal network provided",
          "Required safety approvals for installation completed",
          "Client SPOC assigned on-site during commissioning",
        ],
      },
      {
        id: "warranty",
        kind: "fields",
        title: "Warranty",
        rows: [
          {
            label: "Hardware warranty",
            value: "12 months or as per OEM / manufacturer terms",
          },
          { label: "Software support", value: "During active subscription" },
          { label: "Manufacturer terms", value: "Applicable" },
          {
            label: "Not covered",
            value:
              "Physical / environmental / electrical damage outside specifications",
          },
        ],
      },
      {
        id: "exclusions",
        kind: "bullets",
        title: "Exclusions — Unless Specifically Quoted",
        items: [
          "New CCTV cameras",
          "NVR",
          "PoE switches",
          "LAN / fibre cabling",
          "Electrical cabling",
          "Civil work",
          "Camera poles / mounts",
          "Internet connectivity",
          "UPS",
          "Network switches",
          "ERP / SAP integrations",
          "SMS / WhatsApp charges",
          "New AI detections",
          "Continuous video storage",
          "Third-party licenses",
          "CCTV / network AMC",
          "Installation of speakers on-site",
        ],
      },
      {
        id: "commercial-terms",
        kind: "fields",
        title: "Commercial Terms",
        rows: [
          { label: "Prices", value: "Exclusive of GST" },
          { label: "GST", value: "As applicable" },
          { label: "Advance payment", value: "" },
          { label: "Payment on material delivery", value: "" },
          { label: "Payment after commissioning", value: "" },
          { label: "AMC billing", value: "Annually, in advance" },
          { label: "Delivery period", value: "weeks after PO" },
          { label: "Freight / travel", value: "Excluded" },
          { label: "Purchase order requirement", value: "" },
          { label: "Taxes and duties", value: "As applicable" },
          {
            label: "Price revision clause",
            value: "For imported semiconductor / NVIDIA hardware, if required",
          },
        ],
      },
      {
        id: "acceptance",
        kind: "bullets",
        title: "Acceptance Criteria / UAT",
        items: [
          "Cameras successfully connected",
          "Agreed detections operational",
          "Dashboard operational",
          "Alerts operational",
          "Speakers operational",
          "Evidence logs operational",
          "Detection performance assessed under agreed site conditions",
          "UAT completed jointly with client",
          "Go-live sign-off",
        ],
      },
    ],
  };
}

/**
 * Reads a stored document back, filling in anything a older saved proposal
 * predates.
 *
 * A proposal saved before a section existed must still open: the template will
 * gain sections over time, and a document that failed to load because of one
 * would strand a quote the customer already has.
 */
export function parseVigilProposal(raw: unknown): VigilProposal {
  const base = defaultVigilProposal();
  if (!raw || typeof raw !== "object") return base;

  const stored = raw as Partial<VigilProposal>;
  return {
    header: { ...base.header, ...(stored.header ?? {}) },
    commercialsNote: stored.commercialsNote ?? base.commercialsNote,
    sections:
      Array.isArray(stored.sections) && stored.sections.length > 0
        ? stored.sections
        : base.sections,
  };
}

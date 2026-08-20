import type { LeadStage } from "../leads/api";

export type DealStage = "discovery" | "proposal" | "negotiation" | "won" | "lost";
export type QuoteStatus = "Draft" | "Presented" | "Accepted" | "Rejected" | "Closed";

const SHARED_CLASSDEFS = [
  "classDef won fill:#10b981,stroke:#059669,color:#ffffff;",
  "classDef lost fill:#ef4444,stroke:#dc2626,color:#ffffff;",
  "classDef current fill:#6366f1,stroke:#4338ca,color:#ffffff,stroke-width:2px;",
  "classDef muted fill:#e2e8f0,stroke:#cbd5e1,color:#475569;",
].join("\n");

/**
 * Flowchart that tracks a single deal's journey through the pipeline.
 */
export function dealStageFlowChart(current: DealStage): string {
  const classFor = (id: DealStage): string => {
    if (id === current) return "current";
    if (id === "won") return "won";
    if (id === "lost") return "lost";
    return "muted";
  };

  return [
    "flowchart LR",
    '  D["Discovery"] --> P["Proposal"] --> N["Negotiation"] --> W["Won 🏆"]',
    '  N -. "lost" .-> L["Lost"]',
    '  P -. "lost" .-> L',
    '  D -. "lost" .-> L',
    `  class D ${classFor("discovery")}`,
    `  class P ${classFor("proposal")}`,
    `  class N ${classFor("negotiation")}`,
    `  class W ${classFor("won")}`,
    `  class L ${classFor("lost")}`,
    SHARED_CLASSDEFS,
  ].join("\n");
}

/**
 * Funnel-style overview of the whole deal pipeline: count + total value per stage.
 */
export function dealPipelineChart(
  stats: Record<string, { count: number; value: number }>
): string {
  const formatCur = (val: number) => `$${(val / 1000).toFixed(0)}k`;
  const cell = (id: string, label: string) =>
    `"${label}<br/>${stats[id]?.count || 0} deals<br/>${formatCur(stats[id]?.value || 0)}"`;

  return [
    "flowchart LR",
    `  D[${cell("discovery", "Discovery")}] --> P[${cell("proposal", "Proposal")}]`,
    `  P --> N[${cell("negotiation", "Negotiation")}]`,
    `  N --> W[${cell("won", "Won 🏆")}]`,
    `  N -. lost .-> L[${cell("lost", "Lost")}]`,
    "  class W won",
    "  class L lost",
    "  classDef won fill:#10b981,stroke:#059669,color:#ffffff;",
    "  classDef lost fill:#ef4444,stroke:#dc2626,color:#ffffff;",
  ].join("\n");
}

/**
 * Lifecycle flow of quotes: Draft → Presented → Accepted → Closed, with a Rejected branch.
 */
export function quotePipelineChart(counts: Record<string, number>): string {
  const cell = (id: string, label: string) => `"${label}<br/>${counts[id] || 0} quotes"`;

  return [
    "flowchart LR",
    `  D[${cell("Draft", "Draft")}] --> P[${cell("Presented", "Presented")}]`,
    `  P --> A[${cell("Accepted", "Accepted 🏆")}]`,
    `  A --> C[${cell("Closed", "Closed")}]`,
    `  P -. rejected .-> R[${cell("Rejected", "Rejected")}]`,
    "  class A won",
    "  class C won",
    "  class R lost",
    "  classDef won fill:#10b981,stroke:#059669,color:#ffffff;",
    "  classDef lost fill:#ef4444,stroke:#dc2626,color:#ffffff;",
  ].join("\n");
}

/**
 * Lifecycle flow of leads: count per status, with the qualified path feeding deals.
 */
export function leadLifecycleChart(counts: Record<LeadStage | string, number>): string {
  const cell = (id: string, label: string) => `"${label}<br/>${counts[id] || 0} leads"`;

  return [
    "flowchart LR",
    `  NW(${cell("new", "New")}) --> CT(${cell("contacted", "Contacted")})`,
    `  CT --> RP(${cell("replied", "Replied")})`,
    `  RP --> CB(${cell("call_booked", "Call Booked")})`,
    `  CB --> CD(${cell("call_done", "Call Done")})`,
    `  CD --> CV(${cell("converted", "Converted 🏆")})`,
    `  NW -. dropped .-> DP(${cell("dropped", "Dropped")})`,
    `  CT -. dropped .-> DP`,
    `  RP -. dropped .-> DP`,
    `  CB -. dropped .-> DP`,
    "  class CV won",
    "  class DP lost",
    "  classDef won fill:#10b981,stroke:#059669,color:#ffffff;",
    "  classDef lost fill:#ef4444,stroke:#dc2626,color:#ffffff;",
  ].join("\n");
}

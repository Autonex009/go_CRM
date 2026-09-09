import type { LeadStage } from "../leads/api";

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
    `  NW(${cell("new", "New")}) --> IC(${cell("initial count", "Initial Count")})`,
    `  IC --> DS(${cell("deck sent", "Deck Sent")})`,
    `  DS --> CS(${cell("call scheduled", "Call Scheduled")})`,
    `  CS --> CD(${cell("call done", "Call Done")})`,
    `  CD --> PS(${cell("proposal sent", "Proposal Sent")})`,
    `  PS --> CV(${cell("converted", "Converted 🏆")})`,
    `  NW -. not interested .-> NI(${cell("not interested", "Not Interested")})`,
    `  DS -. not interested .-> NI`,
    `  CS -. not interested .-> NI`,
    "  class CV won",
    "  class NI lost",
    "  classDef won fill:#10b981,stroke:#059669,color:#ffffff;",
    "  classDef lost fill:#ef4444,stroke:#dc2626,color:#ffffff;",
  ].join("\n");
}

"use client";

import { LeadFunnelChart, type FunnelStage } from "./LeadFunnelChart";

/**
 * Treatment-conversion funnel (Consultation → Test → Treatment → Admission).
 * Thin semantic wrapper over the shared descending-bar funnel renderer so each
 * stage stays drill-down clickable via its `entity`/`filters`.
 */
export function TreatmentFunnelChart({ stages }: { stages: FunnelStage[] }) {
  return <LeadFunnelChart stages={stages} />;
}

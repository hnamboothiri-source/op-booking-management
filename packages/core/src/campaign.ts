/**
 * Marketing analytics (Module 13). All money in paise. Helpers return null when
 * a metric is undefined (no spend / no count) so the UI can render "—" instead
 * of dividing by zero.
 */

/** Cost per unit (lead / consultation / admission) in paise. */
export function costPer(spendPaise: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round(spendPaise / count);
}

/** Return on investment as a percentage: (revenue − spend) / spend × 100. */
export function roiPct(revenuePaise: number, spendPaise: number): number | null {
  if (spendPaise <= 0) return null;
  return Math.round(((revenuePaise - spendPaise) / spendPaise) * 1000) / 10;
}

export interface CampaignMetrics {
  leads: number;
  consultations: number;
  admissions: number;
  revenue: number; // paise
  spend: number; // paise
}

export interface CampaignKpis extends CampaignMetrics {
  costPerLead: number | null;
  costPerConsultation: number | null;
  costPerAdmission: number | null;
  roi: number | null;
}

export function campaignKpis(m: CampaignMetrics): CampaignKpis {
  return {
    ...m,
    costPerLead: costPer(m.spend, m.leads),
    costPerConsultation: costPer(m.spend, m.consultations),
    costPerAdmission: costPer(m.spend, m.admissions),
    roi: roiPct(m.revenue, m.spend),
  };
}

// --- Retention risk (Module 12) ---

/** Map a 0..100 retention score to a 0..100 risk score (inverse). */
export function riskFromRetention(retentionScore: number): number {
  return Math.max(0, Math.min(100, 100 - retentionScore));
}

/** Whole months between two dates (0 if the later date precedes the earlier). */
export function monthsBetween(from: Date | null, to: Date): number {
  if (!from) return 0;
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, months);
}

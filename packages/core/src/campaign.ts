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

/** Cost per 1,000 reach (CPM) in paise; null when reach is 0. */
export function costPerThousandReach(spendPaise: number, reach: number): number | null {
  if (reach <= 0) return null;
  return Math.round((spendPaise / reach) * 1000);
}

/** Reach → lead conversion: leads / reach × 100, two decimals; 0 when reach is 0. */
export function reachToLeadRate(leads: number, reach: number): number {
  if (reach <= 0) return 0;
  return Math.round((leads / reach) * 10000) / 100;
}

/** Whether `at` falls within `hours` after `since` (the 24h response window). */
export function withinHours(at: Date, since: Date, hours: number): boolean {
  const ms = at.getTime() - since.getTime();
  return ms >= 0 && ms <= hours * 3_600_000;
}

/** Campaign channels (social/media) and lead response channels (FRS §3, §8). */
export const CAMPAIGN_CHANNELS = ["youtube", "instagram", "google_ads", "facebook", "whatsapp", "newspaper", "tv", "radio", "other"] as const;
export const RESPONSE_CHANNELS = ["call", "whatsapp", "email", "walk_in"] as const;

/** Channel pricing models for the marketing-channel master. */
export const PRICING_MODELS = ["cpm", "cpc", "flat", "per_post"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

/**
 * Quote a channel buy from its rate card + a seasonal offer (master data).
 * CPM bills per 1,000 reach; other models bill the flat baseRate. A bonus-reach
 * offer boosts the delivered reach for the same spend; a discount reduces cost.
 * All money in paise.
 */
export function quoteForReach(args: {
  pricingModel: PricingModel | string;
  baseRate: number;
  reach: number;
  discountPct?: number | null;
  bonusReachPct?: number | null;
}): { cost: number; effectiveReach: number } {
  const reach = Math.max(0, Math.floor(args.reach));
  const effectiveReach = Math.round(reach * (1 + (args.bonusReachPct ?? 0) / 100));
  const base = args.pricingModel === "cpm" ? Math.round((reach / 1000) * args.baseRate) : args.baseRate;
  const cost = Math.round(base * (1 - (args.discountPct ?? 0) / 100));
  return { cost: Math.max(0, cost), effectiveReach };
}

export interface CampaignMetrics {
  leads: number;
  leads24h: number;
  consultations: number;
  admissions: number;
  revenue: number; // paise
  spend: number; // paise
  promisedReach: number;
  achievedReach: number;
}

export interface CampaignKpis extends CampaignMetrics {
  costPerLead: number | null;
  costPerConsultation: number | null;
  costPerAdmission: number | null;
  costPerReach: number | null; // CPM, paise per 1,000 reach
  reachToLead: number; // %
  roi: number | null;
}

export function campaignKpis(m: CampaignMetrics): CampaignKpis {
  const reach = m.achievedReach || m.promisedReach;
  return {
    ...m,
    costPerLead: costPer(m.spend, m.leads),
    costPerConsultation: costPer(m.spend, m.consultations),
    costPerAdmission: costPer(m.spend, m.admissions),
    costPerReach: costPerThousandReach(m.spend, reach),
    reachToLead: reachToLeadRate(m.leads, reach),
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

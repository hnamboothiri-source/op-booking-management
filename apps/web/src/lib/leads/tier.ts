/**
 * Derive a lead's effective priority tier (hot/warm/cold) and first-response
 * SLA state, reusing the core propensity score + SLA helpers. Server-side
 * utility shared by the leads list, detail, and call-centre queues.
 */
import { leadPropensityScore, effectiveTier, slaState, isOpenLead, type LeadTier, type SlaState, type LeadStage } from "@prm/core";

export interface TieredLead {
  priority: "low" | "medium" | "high";
  priorityTier?: string | null;
  stage: LeadStage;
  lastCallOutcome?: string | null;
  followUpDate?: Date | null;
  lastContactAt?: Date | null;
  createdAt: Date;
}

export function leadTier(lead: TieredLead, now: Date): { tier: LeadTier; sla: SlaState | null } {
  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(lead.createdAt).getTime()) / 86_400_000));
  const { rank } = leadPropensityScore({
    priority: lead.priority,
    overdueFollowUp: !!lead.followUpDate && new Date(lead.followUpDate) < now,
    lastOutcome: lead.lastCallOutcome ?? null,
    stage: lead.stage,
    ageDays,
  });
  const tier = effectiveTier(lead.priorityTier, rank);
  // SLA only meaningful while the lead is still open and uncontacted-clock relevant.
  const sla = isOpenLead(lead.stage) ? slaState(tier, new Date(lead.lastContactAt ?? lead.createdAt), now) : null;
  return { tier, sla };
}

export const TIER_TONE: Record<LeadTier, "red" | "amber" | "blue"> = { hot: "red", warm: "amber", cold: "blue" };
export const SLA_TONE: Record<SlaState, "green" | "amber" | "red"> = { on_track: "green", at_risk: "amber", breached: "red" };

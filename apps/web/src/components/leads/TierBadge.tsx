import { Badge } from "@/components/ui";
import { SLA_LABEL, type LeadTier, type SlaState } from "@prm/core";
import { TIER_TONE, SLA_TONE, leadTier, type TieredLead } from "@/lib/leads/tier";

/** Renders a lead's tier chip and (when open) its SLA-state chip. */
export function TierBadge({ tier, sla, showSla = true }: { tier: LeadTier; sla?: SlaState | null; showSla?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={TIER_TONE[tier]}>{tier}</Badge>
      {showSla && sla && <Badge tone={SLA_TONE[sla]}>{SLA_LABEL[sla]}</Badge>}
    </span>
  );
}

/** Convenience: compute + render from a raw lead row. */
export function LeadTierBadge({ lead, now, showSla = true }: { lead: TieredLead; now: Date; showSla?: boolean }) {
  const { tier, sla } = leadTier(lead, now);
  return <TierBadge tier={tier} sla={sla} showSla={showSla} />;
}

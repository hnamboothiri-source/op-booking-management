"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import type { DrillEntity, DrillFilters } from "@prm/core";
import { useDrill } from "@/components/drill/DrillProvider";

export interface FunnelStage {
  label: string;
  value: number;
  entity?: DrillEntity;
  filters?: DrillFilters;
}

// Wine → gold ramp so the funnel reads top (broad) to bottom (narrow).
const COLORS = ["#7d2e46", "#8f3a52", "#a5562f", "#b8732c", "#c0892e", "#ca9a3e"];

/**
 * Lead conversion funnel rendered as descending horizontal bars (Recharts).
 * Clicking a stage opens the drill drawer for that stage's entity/filters.
 */
export function LeadFunnelChart({ stages }: { stages: FunnelStage[] }) {
  const { openDrill } = useDrill();
  const data = stages.map((s, i) => ({ ...s, _i: i }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, stages.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip cursor={{ fill: "rgba(125,46,70,0.08)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar
          dataKey="value"
          radius={[0, 6, 6, 0]}
          cursor="pointer"
          onClick={(state) => {
            const d = (state as unknown as { payload?: FunnelStage }).payload;
            if (d?.entity) openDrill({ entity: d.entity, filters: d.filters ?? {}, label: d.label });
          }}
        >
          {data.map((d) => <Cell key={d._i} fill={COLORS[d._i % COLORS.length]} />)}
          <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

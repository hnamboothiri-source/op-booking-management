"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

export interface BarDatum { label: string; value: number }

const WINE = "#7d2e46";
const GOLD = "#c0892e";

/**
 * Generic horizontal bar chart styled to the wine/gold theme. Used for lead
 * source / executive / branch distributions on the consolidated report.
 */
export function BarChartCard({ data, height = 240, color = WINE, alt = false }: { data: BarDatum[]; height?: number; color?: string; alt?: boolean }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-400">No data.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <Tooltip cursor={{ fill: "rgba(125,46,70,0.08)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={alt && i % 2 ? GOLD : color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

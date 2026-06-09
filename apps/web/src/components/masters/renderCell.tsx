/**
 * Type-aware cell renderer for master/list tables. Extracted from
 * `masters/[entity]/page.tsx` so both the global masters list and the
 * per-module custom-record list (and plan reports) format cells identically.
 */
import { Badge } from "@/components/ui";

export function renderCell(value: unknown, col: string): React.ReactNode {
  if (typeof value === "boolean") return value ? <Badge tone="green">active</Badge> : <Badge tone="red">inactive</Badge>;
  if (value === null || value === undefined || value === "") return <span className="text-slate-300">—</span>;
  if ((col === "price" || col === "estimatedCost" || col === "baseRate" || col === "budget") && typeof value === "number") return `₹${(value / 100).toLocaleString("en-IN")}`;
  if (value instanceof Date || ((col === "fromDate" || col === "toDate" || col.toLowerCase().includes("date")) && (typeof value === "string" || typeof value === "number"))) {
    const d = value instanceof Date ? value : new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(value).replace(/_/g, " ");
}

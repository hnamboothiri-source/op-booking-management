import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

function Tile({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <Card>
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function CallCenter() {
  const user = await requireCan("leads", "view");
  const scope = branchScopeWhere(user.role, user.branchId);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const tomorrow = new Date(today.getTime() + 86400000);

  const [newLeads, pendingCallbacks, dueToday, overdue, bookedToday, missedToday, leadsByOwner, recentCalls] = await Promise.all([
    prisma.lead.count({ where: { ...scope, stage: "new_lead" } }),
    prisma.lead.count({ where: { ...scope, followUpDate: { lte: today }, stage: { in: ["contacted", "interested", "not_reachable", "appointment_suggested"] } } }),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] }, dueDate: { gte: today, lt: tomorrow } } }),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] }, dueDate: { lt: today } } }),
    prisma.opBooking.count({ where: { ...scope, bookedAt: { gte: today } } }),
    prisma.callLog.count({ where: { outcome: "not_reachable", createdAt: { gte: today } } }),
    prisma.lead.groupBy({ by: ["ownerId", "stage"], _count: { _all: true }, where: scope }),
    prisma.callLog.findMany({ include: { lead: true }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  // Conversion by executive (converted = appointment_booked | converted_to_patient).
  const byOwner = new Map<string, { total: number; converted: number }>();
  for (const r of leadsByOwner) {
    const k = r.ownerId ?? "unassigned";
    const cur = byOwner.get(k) ?? { total: 0, converted: 0 };
    cur.total += r._count._all;
    if (r.stage === "appointment_booked" || r.stage === "converted_to_patient") cur.converted += r._count._all;
    byOwner.set(k, cur);
  }
  const owners = await prisma.staffUser.findMany({ where: { id: { in: [...byOwner.keys()].filter((k) => k !== "unassigned") } } });
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? "Unassigned";

  return (
    <div>
      <PageHeader title="Call Center" subtitle="Convert enquiries into appointments (Module 2)" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="New leads" value={newLeads} href="/leads?stage=new_lead" />
        <Tile label="Pending callbacks" value={pendingCallbacks} href="/leads" />
        <Tile label="Follow-ups due today" value={dueToday} href="/follow-ups" />
        <Tile label="Overdue follow-ups" value={overdue} href="/follow-ups" />
        <Tile label="Missed calls today" value={missedToday} />
        <Tile label="Booked today" value={bookedToday} href="/appointments" />
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Conversion by executive</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Executive</th><th className="px-4 py-2">Leads</th><th className="px-4 py-2">Converted</th><th className="px-4 py-2">Rate</th></tr></thead>
          <tbody>
            {[...byOwner.entries()].map(([k, v]) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="px-4 py-2">{k === "unassigned" ? "Unassigned" : ownerName(k)}</td>
                <td className="px-4 py-2">{v.total}</td>
                <td className="px-4 py-2">{v.converted}</td>
                <td className="px-4 py-2">{v.total ? Math.round((v.converted / v.total) * 100) : 0}%</td>
              </tr>
            ))}
            {byOwner.size === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No leads yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent calls (IVR + logged)</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Lead</th><th className="px-4 py-2">Outcome</th><th className="px-4 py-2">Notes</th><th className="px-4 py-2">Recording</th></tr></thead>
          <tbody>
            {recentCalls.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No calls logged yet.</td></tr>}
            {recentCalls.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-500">{c.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2">{c.lead ? <Link href={`/leads/${c.lead.id}`} className="text-rose-700 hover:underline">{c.lead.contactName}</Link> : "—"}</td>
                <td className="px-4 py-2 text-slate-600">{c.outcome.replace(/_/g, " ")}</td>
                <td className="px-4 py-2 text-slate-500">{c.notes ?? "—"}</td>
                <td className="px-4 py-2">{c.recordingUrl ? <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline">play</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

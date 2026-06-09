import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, riskBand, retentionBand, RISK_BAND_LABELS, RISK_BAND_TONE, RETENTION_BAND_TONE } from "@prm/core";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { assignSuccessOwner } from "@/lib/retention/actions";
import { dormantWorklist } from "@/lib/retention/metrics";

export const dynamic = "force-dynamic";

export default async function DormantWorklist({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");
  const sp = await searchParams;

  const filters = {
    branchId: sp.branchId || undefined,
    doctorId: sp.doctorId || undefined,
    diseaseId: sp.diseaseId || undefined,
    minDays: sp.minDays ? Number(sp.minDays) : undefined,
    successOwnerId: sp.successOwnerId || undefined,
  };

  const [rows, branches, doctors, diseases, staff] = await Promise.all([
    dormantWorklist(filters),
    prisma.branch.findMany({ where: { active: true }, select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
    prisma.doctor.findMany({ where: { active: true }, select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
    prisma.diseaseMaster.findMany({ where: { active: true }, select: { id: true, name: true } }).catch(() => [] as { id: string; name: string }[]),
    prisma.staffUser.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const ownerName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "—";
  const waLink = (phone: string | null) => (phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : null);

  return (
    <div>
      <PageHeader
        title="Dormant patient worklist"
        subtitle="At-risk / dormant / lost patients to recover (Module 12)"
        action={<div className="flex items-center gap-2"><LinkButton href="/retention/campaigns" tone="ghost">Campaigns</LinkButton><LinkButton href="/retention" tone="ghost">← Retention</LinkButton></div>}
      />

      {/* Filter bar */}
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Branch
            <select name="branchId" defaultValue={filters.branchId ?? ""} className="rounded border border-slate-300 px-2 py-1"><option value="">All</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </label>
          <label className="flex flex-col">Doctor
            <select name="doctorId" defaultValue={filters.doctorId ?? ""} className="rounded border border-slate-300 px-2 py-1"><option value="">All</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </label>
          <label className="flex flex-col">Disease
            <select name="diseaseId" defaultValue={filters.diseaseId ?? ""} className="rounded border border-slate-300 px-2 py-1"><option value="">All</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </label>
          <label className="flex flex-col">Min days inactive
            <input type="number" name="minDays" defaultValue={filters.minDays ?? ""} className="w-28 rounded border border-slate-300 px-2 py-1" />
          </label>
          <label className="flex flex-col">Executive
            <select name="successOwnerId" defaultValue={filters.successOwnerId ?? ""} className="rounded border border-slate-300 px-2 py-1"><option value="">All</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </label>
          <button className="rounded bg-rose-700 px-3 py-1.5 text-white hover:bg-rose-800">Filter</button>
          <Link href="/retention/worklist" className="px-2 py-1.5 text-slate-500 hover:underline">Clear</Link>
        </form>
      </Card>

      <p className="mb-3 mt-4 text-sm text-slate-500">{rows.length} patient{rows.length === 1 ? "" : "s"}</p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Last visit</th><th className="px-3 py-2 text-right">Days</th><th className="px-3 py-2">Doctor</th><th className="px-3 py-2">Disease</th><th className="px-3 py-2">Retention</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-4 text-slate-400">No patients match these filters.</td></tr>}
            {rows.map((r) => {
              const rb = riskBand(r.riskScore);
              return (
                <tr key={r.mrd} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2"><Link href={`/retention/${encodeURIComponent(r.mrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{r.name}</Link></td>
                  <td className="px-3 py-2 text-slate-500">{r.lastVisitDate ? new Date(r.lastVisitDate).toISOString().slice(0, 10) : "—"}</td>
                  <td className="px-3 py-2 text-right">{r.daysSinceVisit >= 9999 ? "—" : r.daysSinceVisit}</td>
                  <td className="px-3 py-2 text-slate-600">{r.doctorName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.diseaseName}</td>
                  <td className="px-3 py-2">{r.retentionScore != null ? <Badge tone={RETENTION_BAND_TONE[retentionBand(r.retentionScore)]}>{r.retentionScore}</Badge> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2"><Badge tone={RISK_BAND_TONE[rb]}>{RISK_BAND_LABELS[rb]}</Badge></td>
                  <td className="px-3 py-2 text-slate-500">{ownerName(r.successOwnerId)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {r.phone && <a href={`tel:${r.phone}`} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">Call</a>}
                      {waLink(r.whatsapp ?? r.phone) && <a href={waLink(r.whatsapp ?? r.phone)!} target="_blank" rel="noreferrer" className="rounded border border-emerald-200 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50">WhatsApp</a>}
                      <Link href="/retention/campaigns" className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">Campaign</Link>
                      <Link href={`/appointments/new?mrd=${encodeURIComponent(r.mrd)}`} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">Book</Link>
                      {canEdit && (
                        <form action={assignSuccessOwner.bind(null, r.mrd)} className="flex items-center gap-1">
                          <select name="ownerId" defaultValue={r.successOwnerId ?? ""} className="rounded border border-slate-300 px-1 py-0.5"><option value="">assign…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                          <button className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">Set</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

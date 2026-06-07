import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recomputeRetention, assignSuccessOwner, markReactivated } from "@/lib/retention/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Retention() {
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");

  const [statuses, staff, counts] = await Promise.all([
    prisma.retentionStatus.findMany({ include: { patient: true }, orderBy: { riskScore: "desc" }, take: 300 }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.retentionStatus.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const countOf = (c: string) => counts.find((x) => x.category === c)?._count._all ?? 0;
  const owners = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "—";
  const atRisk = statuses.filter((s) => s.category === "at_risk");
  const dormant = statuses.filter((s) => s.category === "dormant" || s.category === "lost");

  return (
    <div>
      <PageHeader
        title="Retention & reactivation"
        subtitle="Identify patients who may be lost and bring them back (Module 12)"
        action={canEdit ? <form action={recomputeRetention}><SubmitButton>Recompute scores</SubmitButton></form> : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card><div className="text-2xl font-bold">{countOf("active")}</div><div className="text-xs text-slate-500">Active</div></Card>
        <Card><div className="text-2xl font-bold text-amber-600">{countOf("at_risk")}</div><div className="text-xs text-slate-500">At risk</div></Card>
        <Card><div className="text-2xl font-bold text-red-600">{countOf("dormant")}</div><div className="text-xs text-slate-500">Dormant</div></Card>
        <Card><div className="text-2xl font-bold text-red-700">{countOf("lost")}</div><div className="text-xs text-slate-500">Lost</div></Card>
        <Card><div className="text-2xl font-bold text-emerald-600">{countOf("reactivated")}</div><div className="text-xs text-slate-500">Reactivated</div></Card>
      </div>

      {statuses.length === 0 && <p className="text-sm text-slate-400">No retention data yet. Click <strong>Recompute scores</strong> to evaluate all patients.</p>}

      {dormant.length > 0 && (
        <Section title={`Dormant / lost (${dormant.length})`} rows={dormant} staff={staff} canEdit={canEdit} owners={owners} />
      )}
      {atRisk.length > 0 && (
        <Section title={`At risk (${atRisk.length})`} rows={atRisk} staff={staff} canEdit={canEdit} owners={owners} />
      )}
    </div>
  );
}

function Section({ title, rows, staff, canEdit, owners }: {
  title: string;
  rows: { patientMrd: string; riskScore: number; category: string; successOwnerId: string | null; patient: { name: string } }[];
  staff: { id: string; name: string }[];
  canEdit: boolean;
  owners: (id: string | null) => string;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Risk</th><th className="px-4 py-2">Success owner</th>{canEdit && <th className="px-4 py-2">Actions</th>}</tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.patientMrd} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(s.patientMrd)}`} className="font-medium text-emerald-700 hover:underline">{s.patient.name}</Link></td>
                <td className="px-4 py-2"><Badge tone={s.riskScore >= 60 ? "red" : s.riskScore >= 30 ? "amber" : "green"}>{s.riskScore}</Badge></td>
                <td className="px-4 py-2 text-slate-600">{owners(s.successOwnerId)}</td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <form action={assignSuccessOwner.bind(null, s.patientMrd)} className="flex items-center gap-1">
                        <select name="ownerId" defaultValue={s.successOwnerId ?? ""} className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">unassigned</option>{staff.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>
                        <button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Assign</button>
                      </form>
                      <form action={markReactivated.bind(null, s.patientMrd)}><button className="rounded border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50">Reactivated</button></form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

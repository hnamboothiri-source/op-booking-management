import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recomputeRetention, assignSuccessOwner, recordReactivation } from "@/lib/retention/actions";
import { can, REACTIVATION_METHODS, REACTIVATION_RESULTS } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { DrillStat } from "@/components/drill/DrillStat";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { approvedActivities } from "@/lib/planning/gate";

export const dynamic = "force-dynamic";

export default async function Retention({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("retention", "view");
  const canEdit = can(user.role, "retention", "edit");
  const filters = listFilters("retention", await searchParams);
  const activeCat = filters.category;

  const [statuses, staff, counts] = await Promise.all([
    prisma.retentionStatus.findMany({ where: activeCat ? DRILL.retention.buildWhere(filters) : {}, include: { patient: true }, orderBy: { riskScore: "desc" }, take: 300 }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.retentionStatus.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);
  const countOf = (c: string) => counts.find((x) => x.category === c)?._count._all ?? 0;
  const owners = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "—";
  const atRisk = statuses.filter((s) => s.category === "at_risk");
  const dormant = statuses.filter((s) => s.category === "dormant" || s.category === "lost");
  const drives = await approvedActivities("retention", "reactivation_drive");

  return (
    <div>
      <PageHeader
        title="Retention & reactivation"
        subtitle="Identify patients who may be lost and bring them back (Module 12)"
        action={canEdit ? <form action={recomputeRetention}><SubmitButton>Recompute scores</SubmitButton></form> : undefined}
      />

      <div className={`mb-6 rounded-xl border px-4 py-2 text-sm ${drives.length ? "border-rose-100 bg-rose-50/60 text-slate-600" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
        {drives.length
          ? <>Reactivations are recorded under the approved drive: <span className="font-medium">{drives.map((d) => d.label).join(", ")}</span>. <Link href="/modules/retention/plan" className="text-rose-700 hover:underline">View plan →</Link></>
          : <>No approved reactivation drive — <Link href="/modules/retention/plan" className="font-medium underline">plan &amp; approve one first →</Link> (reactivations are gated on it).</>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <DrillStat label="Active" value={countOf("active")} entity="retention" filters={{ category: "active" }} />
        <DrillStat label="At risk" value={countOf("at_risk")} entity="retention" filters={{ category: "at_risk" }} />
        <DrillStat label="Dormant" value={countOf("dormant")} entity="retention" filters={{ category: "dormant" }} />
        <DrillStat label="Lost" value={countOf("lost")} entity="retention" filters={{ category: "lost" }} />
        <DrillStat label="Reactivated" value={countOf("reactivated")} entity="retention" filters={{ category: "reactivated" }} />
      </div>

      <ActiveFilters filters={filters} basePath="/retention" />

      {statuses.length === 0 && <p className="text-sm text-slate-400">No retention data {activeCat ? "in this category" : "yet"}. {!activeCat && <>Click <strong>Recompute scores</strong> to evaluate all patients.</>}</p>}

      {activeCat ? (
        statuses.length > 0 && <Section title={`${activeCat.replace(/_/g, " ")} (${statuses.length})`} rows={statuses} staff={staff} canEdit={canEdit} owners={owners} />
      ) : (
        <>
          {dormant.length > 0 && <Section title={`Dormant / lost (${dormant.length})`} rows={dormant} staff={staff} canEdit={canEdit} owners={owners} />}
          {atRisk.length > 0 && <Section title={`At risk (${atRisk.length})`} rows={atRisk} staff={staff} canEdit={canEdit} owners={owners} />}
        </>
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
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(s.patientMrd)}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{s.patient.name}</Link></td>
                <td className="px-4 py-2"><Badge tone={s.riskScore >= 60 ? "red" : s.riskScore >= 30 ? "amber" : "green"}>{s.riskScore}</Badge></td>
                <td className="px-4 py-2 text-slate-600">{owners(s.successOwnerId)}</td>
                {canEdit && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <form action={assignSuccessOwner.bind(null, s.patientMrd)} className="flex items-center gap-1">
                        <select name="ownerId" defaultValue={s.successOwnerId ?? ""} className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">unassigned</option>{staff.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>
                        <button className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">Assign</button>
                      </form>
                      <form action={recordReactivation.bind(null, s.patientMrd)} className="flex items-center gap-1">
                        <select name="reactivationMethod" required defaultValue="" className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">method…</option>{REACTIVATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                        <select name="reactivationResult" required defaultValue="" className="rounded border border-slate-300 px-1 py-0.5 text-xs"><option value="">result…</option>{REACTIVATION_RESULTS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}</select>
                        <input name="reactivationNote" placeholder="note" className="w-24 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                        <button className="rounded border border-rose-200 px-2 py-0.5 text-xs text-rose-700 hover:bg-rose-50">Save</button>
                      </form>
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

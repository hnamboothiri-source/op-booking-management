import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { leadPropensityScore, branchScopeWhere } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const RANK_TONE = { hot: "red", warm: "amber", cold: "slate" } as const;

export default async function Prioritize() {
  const user = await requireCan("leads", "view");
  const today = new Date(new Date().toISOString().slice(0, 10));

  const openLeads = await prisma.lead.findMany({
    where: {
      ...branchScopeWhere(user.role, user.branchId),
      stage: { notIn: ["lost", "not_interested", "converted_to_patient", "appointment_booked"] },
    },
    include: { source: true, owner: true },
    take: 500,
  });

  const ranked = openLeads
    .map((l) => {
      const ageDays = Math.floor((today.getTime() - new Date(l.createdAt).getTime()) / 86400000);
      const p = leadPropensityScore({
        priority: l.priority as "low" | "medium" | "high",
        overdueFollowUp: !!l.followUpDate && l.followUpDate < today,
        lastOutcome: l.lastCallOutcome,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stage: l.stage as any,
        ageDays,
      });
      return { l, p };
    })
    .sort((a, b) => b.p.score - a.p.score);

  const highRisk = await prisma.retentionStatus.findMany({
    where: { category: { in: ["dormant", "lost", "at_risk"] } },
    include: { patient: true },
    orderBy: { riskScore: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader title="Next best actions" subtitle="AI-ready propensity ranking — who to contact first (Phase 5)" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Top open leads ({ranked.length})</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Score</th><th className="px-4 py-2">Lead</th><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Owner</th></tr></thead>
              <tbody>
                {ranked.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No open leads.</td></tr>}
                {ranked.slice(0, 30).map(({ l, p }) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-4 py-2"><Badge tone={RANK_TONE[p.rank]}>{p.score} · {p.rank}</Badge></td>
                    <td className="px-4 py-2"><Link href={`/leads/${l.id}`} className="font-medium text-emerald-700 hover:underline">{l.contactName}</Link><div className="text-xs text-slate-400">{l.phone}</div></td>
                    <td className="px-4 py-2 text-slate-600">{l.stage.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-slate-600">{l.source?.name?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{l.owner?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">High-risk patients</h3>
          {highRisk.length === 0 ? <p className="text-sm text-slate-400">Run retention recompute first.</p> : (
            <ul className="space-y-1 text-sm">
              {highRisk.map((s) => (
                <li key={s.patientMrd} className="flex items-center justify-between">
                  <Link href={`/patients/${encodeURIComponent(s.patientMrd)}`} className="text-emerald-700 hover:underline">{s.patient.name}</Link>
                  <Badge tone={s.riskScore >= 60 ? "red" : "amber"}>{s.riskScore}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

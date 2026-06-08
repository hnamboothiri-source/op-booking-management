import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";

const OUTCOMES = [
  "appointment_booked", "follow_up_required", "not_reachable", "call_later",
  "asked_for_doctor_details", "asked_for_treatment_cost", "interested_in_branch_visit",
  "interested_in_admission", "not_interested",
];

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireCan("calls", "view");
  const filters = listFilters("calls", await searchParams);
  const outcome = filters.outcome;

  const calls = await prisma.callLog.findMany({
    where: DRILL.calls.buildWhere(filters),
    include: { lead: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Calls" subtitle={`${calls.length} call${calls.length === 1 ? "" : "s"} (IVR + logged · Module 2)`} />

      <ActiveFilters filters={filters} basePath="/calls" />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/calls" className={`rounded-full px-3 py-1 ${!outcome ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>All</Link>
        {OUTCOMES.map((o) => (
          <Link key={o} href={`/calls?outcome=${o}`} className={`rounded-full px-3 py-1 ${outcome === o ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
            {o.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Lead</th>
              <th className="px-4 py-2 font-medium">Outcome</th><th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Notes</th><th className="px-4 py-2 font-medium">Recording</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No calls.</td></tr>}
            {calls.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{c.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2">{c.lead ? <Link href={`/leads/${c.lead.id}`} className="text-rose-700 hover:underline dark:text-rose-400">{c.lead.contactName}</Link> : c.patientMrd ? <Link href={`/patients/${encodeURIComponent(c.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-400">{c.patientMrd}</Link> : "—"}</td>
                <td className="px-4 py-2"><Badge tone={c.outcome === "appointment_booked" ? "green" : c.outcome === "not_reachable" || c.outcome === "not_interested" ? "red" : "slate"}>{c.outcome.replace(/_/g, " ")}</Badge></td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.durationSec ? `${Math.round(c.durationSec / 60)} min` : "—"}</td>
                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{c.notes ?? "—"}</td>
                <td className="px-4 py-2">{c.recordingUrl ? <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline dark:text-rose-400">play</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

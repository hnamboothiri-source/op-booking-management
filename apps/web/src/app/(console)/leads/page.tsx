import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, can, LEAD_STAGES } from "@prm/core";
import { PageHeader, LinkButton, Badge } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";
import { LeadTierBadge } from "@/components/leads/TierBadge";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCan("leads", "view");
  const filters = listFilters("leads", await searchParams);
  const stage = filters.stage;
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: {
      ...branchScopeWhere(user.role, user.branchId),
      ...DRILL.leads.buildWhere(filters),
    },
    include: { source: true, owner: true, branch: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} lead${leads.length === 1 ? "" : "s"}${stage ? ` · ${stage.replace(/_/g, " ")}` : ""}`}
        action={can(user.role, "leads", "create") ? <LinkButton href="/leads/new">+ New lead</LinkButton> : undefined}
      />

      <ActiveFilters filters={filters} basePath="/leads" />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/leads" className={`rounded-full px-3 py-1 ${!stage ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>All</Link>
        {LEAD_STAGES.map((s) => (
          <Link key={s} href={`/leads?stage=${s}`} className={`rounded-full px-3 py-1 ${stage === s ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Source</th><th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Priority / SLA</th>
              <th className="px-4 py-2 font-medium">Owner</th><th className="px-4 py-2 font-medium">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No leads.</td></tr>}
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2"><Link href={`/leads/${l.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-300">{l.contactName}</Link></td>
                <td className="px-4 py-2 text-slate-600">{l.phone}</td>
                <td className="px-4 py-2 text-slate-600">{l.source?.name?.replace(/_/g, " ") ?? "—"}</td>
                <td className="px-4 py-2"><Badge tone="blue">{l.stage.replace(/_/g, " ")}</Badge></td>
                <td className="px-4 py-2"><LeadTierBadge lead={l} now={now} /></td>
                <td className="px-4 py-2 text-slate-600">{l.owner?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{l.followUpDate ? l.followUpDate.toISOString().slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

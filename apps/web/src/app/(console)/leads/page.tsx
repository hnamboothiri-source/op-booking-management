import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, can, LEAD_STAGES } from "@prm/core";
import { PageHeader, LinkButton, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const user = await requireCan("leads", "view");
  const { stage } = await searchParams;

  const leads = await prisma.lead.findMany({
    where: {
      ...branchScopeWhere(user.role, user.branchId),
      mergedIntoId: null, // hide leads merged into another
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(stage ? { stage: stage as any } : {}),
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

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/leads" className={`rounded-full px-3 py-1 ${!stage ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>All</Link>
        {LEAD_STAGES.map((s) => (
          <Link key={s} href={`/leads?stage=${s}`} className={`rounded-full px-3 py-1 ${stage === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Source</th><th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Owner</th><th className="px-4 py-2 font-medium">Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No leads.</td></tr>}
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2"><Link href={`/leads/${l.id}`} className="font-medium text-emerald-700 hover:underline">{l.contactName}</Link></td>
                <td className="px-4 py-2 text-slate-600">{l.phone}</td>
                <td className="px-4 py-2 text-slate-600">{l.source?.name?.replace(/_/g, " ") ?? "—"}</td>
                <td className="px-4 py-2"><Badge tone="blue">{l.stage.replace(/_/g, " ")}</Badge></td>
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

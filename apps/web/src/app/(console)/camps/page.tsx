import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createCamp } from "@/lib/outreach/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function Camps() {
  const user = await requireCan("camps", "view");
  const [camps, orgs] = await Promise.all([
    prisma.camp.findMany({ include: { organizer: true, _count: { select: { campPatients: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.organization.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Camps" subtitle="Outreach camps — screened → converted → revenue (Module 7)" />
      {can(user.role, "camps", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New camp</h2>
          <form action={createCamp} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="name" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Location<input name="location" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Organizer<select name="organizerId" className={input}><option value="">—</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Date<input type="date" name="scheduledAt" className={input} /></label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Create camp</SubmitButton></div>
          </form>
        </Card>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {camps.length === 0 && <p className="text-sm text-slate-400">No camps yet.</p>}
        {camps.map((c) => (
          <Link key={c.id} href={`/camps/${c.id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
            <div className="flex items-center justify-between"><span className="font-semibold">{c.name}</span><Badge tone={c.status === "completed" ? "green" : "slate"}>{c.status}</Badge></div>
            <div className="mt-1 text-xs text-slate-500">{c.location ?? "—"}{c.organizer ? ` · ${c.organizer.name}` : ""}</div>
            <div className="mt-2 text-sm">{c._count.campPatients} screened · ₹{(c.revenue / 100).toLocaleString("en-IN")}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

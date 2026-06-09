import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, REFERRER_TYPES, REFERRER_TYPE_LABELS, type ReferrerType } from "@prm/core";
import { createReferrer } from "@/lib/referrals/actions";
import { PageHeader, Card, Badge, SubmitButton, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

export default async function ReferrersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireCan("referrals", "view");
  const canEdit = can(user.role, "referrals", "edit");
  const { type } = await searchParams;
  const where = type && REFERRER_TYPES.includes(type as ReferrerType) ? { type } : {};

  const [referrers, staff] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.referrer.findMany({ where: where as any, include: { relationManager: true }, orderBy: { score: "desc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Referrers" subtitle="External doctors, hospitals, practitioners & partners" action={<LinkButton href="/referrals" tone="ghost">← Referrals</LinkButton>} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/referrals/referrers" className={`rounded-full px-3 py-1 text-sm ${!type ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>All</Link>
        {REFERRER_TYPES.map((t) => (
          <Link key={t} href={`/referrals/referrers?type=${t}`} className={`rounded-full px-3 py-1 text-sm ${type === t ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{REFERRER_TYPE_LABELS[t]}</Link>
        ))}
      </div>

      {canEdit && (
        <Card>
          <h2 className="mb-3 font-semibold">New referrer</h2>
          <form action={createReferrer} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Type<select name="type" className={input}>{REFERRER_TYPES.map((t) => <option key={t} value={t}>{REFERRER_TYPE_LABELS[t]}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Name *<input name="name" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Specialty<input name="specialty" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Hospital / clinic<input name="hospitalName" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Phone<input name="phone" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Email<input name="email" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Location<input name="location" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Relationship manager<select name="relationManagerId" className={input}><option value="">— me —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Add referrer</SubmitButton></div>
          </form>
        </Card>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Manager</th><th className="px-4 py-2">Last meeting</th><th className="px-4 py-2 text-right">Score</th></tr>
          </thead>
          <tbody>
            {referrers.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No referrers yet.</td></tr>}
            {referrers.map((r) => (
              <tr key={r.id as string} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/referrals/referrers/${r.id}`} className="font-medium text-rose-700 hover:underline dark:text-rose-400">{r.name as string}</Link>{!r.active && <Badge tone="red">inactive</Badge>}</td>
                <td className="px-4 py-2 text-slate-600">{REFERRER_TYPE_LABELS[r.type as ReferrerType]}</td>
                <td className="px-4 py-2 text-slate-600">{(r.relationManager as { name?: string } | null)?.name ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{iso(r.lastMeetingDate as Date | null)}</td>
                <td className="px-4 py-2 text-right"><Badge tone={(r.score as number) >= 60 ? "green" : (r.score as number) >= 30 ? "amber" : "slate"}>{r.score as number}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

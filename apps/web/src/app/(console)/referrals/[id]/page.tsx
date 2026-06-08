import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateReferralStatus } from "@/lib/referrals/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
const STATUSES = ["pending", "consulted", "admitted", "lost"];

export default async function ReferralDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("referrals", "view");
  const r = await prisma.referral.findUnique({ where: { id }, include: { referrerPatient: true, referredPatient: true, organization: true } });
  if (!r) notFound();
  const canEdit = can(user.role, "referrals", "edit");

  return (
    <div>
      <PageHeader title={`Referral · ${r.type.replace(/_/g, " ")}`} action={<Badge tone={r.status === "admitted" ? "green" : r.status === "lost" ? "red" : "blue"}>{r.status}</Badge>} />
      <div className="mb-6"><Link href="/referrals" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Referrals</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Referrer</div><div className="font-medium">{r.referrerPatient?.name ?? r.referrerName ?? r.organization?.name ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Referred</div><div className="font-medium">{r.referredPatient?.name ?? r.referredPatientMrd ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Revenue</div><div className="font-medium">₹{(r.revenue / 100).toLocaleString("en-IN")}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Created</div><div className="font-medium">{r.createdAt.toISOString().slice(0, 10)}</div></Card>
      </div>

      {canEdit && (
        <form action={updateReferralStatus.bind(null, r.id)} className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">Status
            <select name="status" defaultValue={r.status} className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">Revenue ₹<input name="revenue" placeholder="0" className="ml-2 w-24 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
          <button className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Save</button>
        </form>
      )}
    </div>
  );
}

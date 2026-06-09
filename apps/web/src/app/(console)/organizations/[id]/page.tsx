import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { setNextEngagement, logEngagement } from "@/lib/organizations/actions";
import { can, ENGAGEMENT_TYPES } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { PlanActivitySelect } from "@/components/planning/PlanActivitySelect";

export const dynamic = "force-dynamic";

export default async function OrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("organizations", "view");
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { camps: { orderBy: { createdAt: "desc" } }, referrals: { orderBy: { createdAt: "desc" } } },
  });
  if (!org) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engagements = (await prisma.organizationEngagement.findMany({ where: { organizationId: id } as any, orderBy: { at: "desc" } }).catch(() => [])) as { id: string; type: string; outcome: string; notes: string | null; at: Date }[];
  const contacts = (org.contactPersons as { name: string }[] | null) ?? [];
  const referralRevenue = org.referrals.reduce((s, r) => s + r.revenue, 0);

  return (
    <div>
      <PageHeader title={org.name} subtitle={org.type.replace(/_/g, " ")} />
      <div className="mb-4"><Link href="/organizations" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Organizations</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Camps conducted" value={org.camps.length} entity="camps" filters={{ organizerId: id }} />
        <DrillStat label="Referrals" value={org.referrals.length} entity="referrals" filters={{ organizationId: id }} />
        <Card><div className="text-2xl font-bold">₹{(referralRevenue / 100).toLocaleString("en-IN")}</div><div className="text-xs text-slate-500 dark:text-slate-400">Referral revenue</div></Card>
        <Card><div className="text-sm font-medium">{org.nextEngagement ? org.nextEngagement.toISOString().slice(0, 10) : "—"}</div><div className="text-xs text-slate-500 dark:text-slate-400">Next engagement</div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Contacts</h3>
          {contacts.length === 0 ? <p className="text-sm text-slate-400">None.</p> : <ul className="space-y-1 text-sm">{contacts.map((c, i) => <li key={i}>{c.name}</li>)}</ul>}
          {can(user.role, "organizations", "edit") && (
            <form action={setNextEngagement.bind(null, id)} className="mt-4 flex items-end gap-2">
              <label className="text-xs text-slate-500">Set next engagement<input type="date" name="nextEngagement" className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm" /></label>
              <SubmitButton>Save</SubmitButton>
            </form>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Camps</h3>
          {org.camps.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
            <ul className="space-y-1 text-sm">{org.camps.map((c) => <li key={c.id} className="flex justify-between"><Link href={`/camps/${c.id}`} className="text-rose-700 hover:underline dark:text-rose-300">{c.name}</Link><Badge tone="slate">{c.patientsScreened} screened</Badge></li>)}</ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Engagements</h2>
        {can(user.role, "organizations", "edit") && (
          <Card>
            <form action={logEngagement.bind(null, id)} className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Type<select name="type" className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800">{ENGAGEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-300">Outcome *<input name="outcome" required placeholder="What came out of it" className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Next engagement<input type="date" name="nextEngagement" className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
              <PlanActivitySelect slug="organizations" typeKey="engagement_plan" />
              <SubmitButton tone="ghost">Log engagement</SubmitButton>
            </form>
          </Card>
        )}
        <div className="mt-3 space-y-1">
          {engagements.length === 0 ? <p className="text-sm text-slate-400">No engagements logged.</p> : engagements.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              <span><Badge tone="slate">{e.type}</Badge> <span className="ml-2">{e.outcome}</span>{e.notes ? <span className="text-slate-400"> — {e.notes}</span> : ""}</span>
              <span className="text-xs text-slate-400">{new Date(e.at).toISOString().slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { setNextEngagement } from "@/lib/organizations/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("organizations", "view");
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { camps: { orderBy: { createdAt: "desc" } }, referrals: { orderBy: { createdAt: "desc" } } },
  });
  if (!org) notFound();
  const contacts = (org.contactPersons as { name: string }[] | null) ?? [];
  const referralRevenue = org.referrals.reduce((s, r) => s + r.revenue, 0);

  return (
    <div>
      <PageHeader title={org.name} subtitle={org.type.replace(/_/g, " ")} />
      <div className="mb-4"><Link href="/organizations" className="text-sm text-slate-500 hover:underline">← Organizations</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{org.camps.length}</div><div className="text-xs text-slate-500">Camps conducted</div></Card>
        <Card><div className="text-2xl font-bold">{org.referrals.length}</div><div className="text-xs text-slate-500">Referrals</div></Card>
        <Card><div className="text-2xl font-bold">₹{(referralRevenue / 100).toLocaleString("en-IN")}</div><div className="text-xs text-slate-500">Referral revenue</div></Card>
        <Card><div className="text-sm font-medium">{org.nextEngagement ? org.nextEngagement.toISOString().slice(0, 10) : "—"}</div><div className="text-xs text-slate-500">Next engagement</div></Card>
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
            <ul className="space-y-1 text-sm">{org.camps.map((c) => <li key={c.id} className="flex justify-between"><Link href={`/camps/${c.id}`} className="text-rose-700 hover:underline">{c.name}</Link><Badge tone="slate">{c.patientsScreened} screened</Badge></li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}

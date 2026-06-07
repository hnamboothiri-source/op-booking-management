import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createLead } from "@/lib/leads/actions";
import { PageHeader, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export default async function NewLead() {
  await requireCan("leads", "create");
  const [sources, campaigns, diseases, branches, staff] = await Promise.all([
    prisma.leadSourceMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="New lead" subtitle="Capture an enquiry (Module 1)" />
      <div className="mb-4"><Link href="/leads" className="text-sm text-slate-500 hover:underline">← Leads</Link></div>
      <form action={createLead} className="grid max-w-2xl grid-cols-2 gap-4">
        <label className="text-sm font-medium text-slate-700">Name *<input name="contactName" required className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Phone *<input name="phone" required className={input} /></label>
        <label className="text-sm font-medium text-slate-700">WhatsApp<input name="whatsapp" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Email<input name="email" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Source
          <select name="sourceId" className={input}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</option>)}</select>
        </label>
        <label className="text-sm font-medium text-slate-700">Campaign
          <select name="campaignId" className={input}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="text-sm font-medium text-slate-700">Disease / complaint
          <select name="diseaseId" className={input}><option value="">—</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </label>
        <label className="text-sm font-medium text-slate-700">Preferred branch
          <select name="branchId" className={input}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </label>
        <label className="text-sm font-medium text-slate-700">Preferred doctor<input name="preferredDoctor" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Priority
          <select name="priority" defaultValue="medium" className={input}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
        </label>
        <label className="text-sm font-medium text-slate-700">Owner
          <select name="ownerId" className={input}><option value="">— me —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>
        <div className="col-span-2"><SubmitButton>Create lead</SubmitButton></div>
      </form>
    </div>
  );
}

import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { sendBulk } from "@/lib/communication/actions";
import MessageComposer from "@/components/MessageComposer";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";
import { DRILL, listFilters } from "@/lib/drill/registry";
import { ActiveFilters } from "@/components/drill/ActiveFilters";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const CHANNELS = ["whatsapp", "sms", "email"];
const CATEGORIES = ["new_patient", "repeat_patient", "high_value", "dormant", "at_risk", "vip"];

export default async function Communication({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireCan("communication", "view");
  const filters = listFilters("communications", await searchParams);
  const [templates, logs] = await Promise.all([
    prisma.communicationTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.communicationLog.findMany({ where: DRILL.communications.buildWhere(filters), include: { patient: true, template: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div>
      <PageHeader title="Engagement & Communication" subtitle="WhatsApp / SMS / email with templates & consent (Module 11)" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Send to a patient</h2>
          <MessageComposer templates={templates.map((t) => ({ id: t.id, name: t.name, channel: t.channel, body: t.body }))} />
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Bulk / campaign send</h2>
          <form action={sendBulk} className="space-y-3">
            <select name="category" className={input}><option value="">All patients</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</select>
            <div className="grid grid-cols-2 gap-2">
              <select name="channel" className={input}>{CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <select name="templateId" className={input}><option value="">— template —</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
            <p className="text-xs text-slate-400">Only patients who have consented to the channel are messaged.</p>
            <SubmitButton>Send to segment</SubmitButton>
          </form>
        </Card>
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent messages ({logs.length})</h2>
      <ActiveFilters filters={filters} basePath="/communication" />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Channel</th><th className="px-4 py-2">To</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Status</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No messages yet.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-500">{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-4 py-2">{l.channel}</td>
                <td className="px-4 py-2 text-slate-600">{l.toAddress}</td>
                <td className="px-4 py-2 text-slate-600">{l.patient?.name ?? "—"}</td>
                <td className="px-4 py-2"><Badge tone={l.status === "failed" ? "red" : "green"}>{l.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

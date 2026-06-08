import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere, conversionRate, can, type Resource, type DrillEntity, type DrillFilters } from "@prm/core";
import { PageHeader } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";

export const dynamic = "force-dynamic";
const OPEN = ["new_lead", "contacted", "interested", "not_reachable", "appointment_suggested"];

export default async function LeadHub() {
  const user = await requireCan("leads", "view");
  const scope = branchScopeWhere(user.role, user.branchId);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (extra: Record<string, unknown> = {}) => ({ ...scope, mergedIntoId: null, ...extra } as any);

  const [total, converted, newLeads, unassigned, pending, hot, dueFu] = await Promise.all([
    prisma.lead.count({ where: L() }),
    prisma.lead.count({ where: L({ stage: { in: ["appointment_booked", "converted_to_patient"] } }) }),
    prisma.lead.count({ where: L({ stage: "new_lead" }) }),
    prisma.lead.count({ where: L({ ownerId: null, stage: { in: OPEN } }) }),
    prisma.lead.count({ where: L({ followUpDate: { lte: today }, stage: { in: ["contacted", "interested", "not_reachable", "appointment_suggested"] } }) }),
    prisma.lead.count({ where: L({ priorityTier: "hot", stage: { in: OPEN } }) }),
    prisma.followUp.count({ where: { status: { in: ["pending", "booked"] }, dueDate: { gte: today, lt: tomorrow } } }),
  ]);

  const tiles: { label: string; value: React.ReactNode; entity: DrillEntity; filters: DrillFilters }[] = [
    { label: "New leads", value: newLeads, entity: "leads", filters: { stage: "new_lead" } },
    { label: "Unassigned", value: unassigned, entity: "leads", filters: { unassigned: "true" } },
    { label: "Pending callbacks", value: pending, entity: "leads", filters: { callback: "pending" } },
    { label: "Hot leads", value: hot, entity: "leads", filters: { priorityTier: "hot" } },
    { label: "Due follow-ups", value: dueFu, entity: "followups", filters: { due: "today" } },
    { label: "Conversion", value: `${conversionRate(converted, total)}%`, entity: "leads", filters: { stage: "appointment_booked,converted_to_patient" } },
  ];

  const allCards: { title: string; desc: string; href: string; resource: Resource; action?: "view" | "create" }[] = [
    { title: "Outreach campaigns", desc: "Area → audience → channels & reach → 24h leads", href: "/campaigns", resource: "campaigns" },
    { title: "Leads", desc: "Full lead list, stages, filters & priority/SLA", href: "/leads", resource: "leads" },
    { title: "New lead", desc: "Capture an enquiry with duplicate detection", href: "/leads/new", resource: "leads", action: "create" },
    { title: "Prioritize", desc: "Hot / warm / cold work queue by propensity", href: "/prioritize", resource: "calls" },
    { title: "Call Centre", desc: "Overview of the three desks + executive funnel", href: "/call-center", resource: "calls" },
    { title: "Reception", desc: "Inbound enquiry & booking calls", href: "/reception", resource: "calls" },
    { title: "Front Office", desc: "Review calls to consulted patients", href: "/front-office", resource: "follow_ups" },
    { title: "Back Office", desc: "Outbound calls to acquired leads", href: "/back-office", resource: "calls" },
    { title: "Calls", desc: "Call log across leads & patients", href: "/calls", resource: "calls" },
    { title: "Follow-ups", desc: "Due / overdue follow-ups with ageing", href: "/follow-ups", resource: "follow_ups" },
    { title: "Messaging", desc: "WhatsApp / SMS / email to patients", href: "/communication", resource: "communication" },
    { title: "Lead report", desc: "Funnel, source, executive, branch, campaign ROI", href: "/reports/leads", resource: "reports" },
  ];
  const cards = allCards.filter((c) => can(user.role, c.resource, c.action ?? "view"));

  return (
    <div>
      <PageHeader title="Lead Management" subtitle="Capture → call → appointment → conversion (Module 1)" />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => <DrillStat key={t.label} label={t.label} value={t.value} entity={t.entity} filters={t.filters} />)}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspaces</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-700">
            <div className="flex items-center gap-1 font-semibold text-slate-800 group-hover:text-rose-700 dark:text-slate-100 dark:group-hover:text-rose-300">{c.title}<span className="opacity-0 transition-opacity group-hover:opacity-100">→</span></div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

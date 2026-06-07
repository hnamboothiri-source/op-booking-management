import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createMobileClinic } from "@/lib/outreach/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function MobileClinics() {
  const user = await requireCan("mobile_clinics", "view");
  const clinics = await prisma.mobileClinic.findMany({ include: { _count: { select: { patients: true } } }, orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader title="Mobile clinics" subtitle="Route-based screening & conversion (Module 8)" />
      {can(user.role, "mobile_clinics", "create") && (
        <Card>
          <h2 className="mb-3 font-semibold">New route</h2>
          <form action={createMobileClinic} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Route name<input name="routeName" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Location<input name="location" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Date<input type="date" name="scheduledAt" className={input} /></label>
            <div className="col-span-2 flex items-end sm:col-span-1"><SubmitButton>Create route</SubmitButton></div>
          </form>
        </Card>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clinics.length === 0 && <p className="text-sm text-slate-400">No routes yet.</p>}
        {clinics.map((c) => (
          <Link key={c.id} href={`/mobile-clinics/${c.id}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
            <div className="flex items-center justify-between"><span className="font-semibold">{c.routeName}</span><Badge tone={c.status === "completed" ? "green" : "slate"}>{c.status}</Badge></div>
            <div className="mt-1 text-xs text-slate-500">{c.location ?? "—"}</div>
            <div className="mt-2 text-sm">{c._count.patients} screened</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

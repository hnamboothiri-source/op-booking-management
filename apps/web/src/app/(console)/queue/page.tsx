import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, Badge, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Queue({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireCan("consultations", "view");
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);

  const queue = await prisma.opBooking.findMany({
    where: {
      appointmentDate: new Date(day),
      status: { in: ["arrived", "waiting", "in_consultation"] },
      ...branchScopeWhere(user.role, user.branchId),
    },
    include: { patient: true, doctor: true, department: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <div>
      <PageHeader title="Patient queue" subtitle={`Waiting / in consultation on ${day} (Module 5)`} />
      <form className="mb-4 flex items-center gap-2 text-sm" action="/queue">
        <label className="text-slate-500">Date</label>
        <input type="date" name="date" defaultValue={day} className="rounded-md border border-slate-300 px-2 py-1.5" />
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Go</button>
      </form>

      <div className="space-y-2">
        {queue.length === 0 && <p className="text-sm text-slate-400">No patients waiting. Check them in from <a href="/appointments" className="text-emerald-700 underline">Appointments</a>.</p>}
        {queue.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="font-medium">{b.startTime} · {b.patient.name}</div>
              <div className="text-xs text-slate-500">{b.doctor.name} · {b.department.name} · {b.bookingRef}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="amber">{b.status.replace(/_/g, " ")}</Badge>
              <LinkButton href={`/consultations/${b.id}`}>Consult</LinkButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

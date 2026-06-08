import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { PageHeader, Badge, LinkButton } from "@/components/ui";
import { DrillCount } from "@/components/drill/DrillCount";

export const dynamic = "force-dynamic";

export default async function Queue({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireCan("consultations", "view");
  const { date } = await searchParams;
  const day = date ?? new Date().toISOString().slice(0, 10);
  const QUEUE_STATUSES = "arrived,waiting,in_consultation";

  const queue = await prisma.opBooking.findMany({
    where: {
      appointmentDate: new Date(day),
      status: { in: ["arrived", "waiting", "in_consultation"] },
      ...branchScopeWhere(user.role, user.branchId),
    },
    include: { patient: true, doctor: true, department: true },
    orderBy: { startTime: "asc" },
  });

  // Order by issued token (nulls last), then scheduled time.
  queue.sort((a, b) => {
    const ta = a.queueToken ?? Number.MAX_SAFE_INTEGER, tb = b.queueToken ?? Number.MAX_SAFE_INTEGER;
    return ta !== tb ? ta - tb : a.startTime.localeCompare(b.startTime);
  });
  const now = Date.now();
  const waited = (since: Date | null) => {
    if (!since) return null;
    const m = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  return (
    <div>
      <PageHeader title="Patient queue" subtitle={`Waiting / in consultation on ${day} (Module 5)`} />
      <form className="mb-4 flex items-center gap-2 text-sm" action="/queue">
        <label className="text-slate-500">Date</label>
        <input type="date" name="date" defaultValue={day} className="rounded-md border border-slate-300 px-2 py-1.5" />
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Go</button>
      </form>

      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        <DrillCount value={queue.length} entity="appointments" filters={{ date: day, status: QUEUE_STATUSES }} label="Queue" /> in queue
      </p>

      <div className="space-y-2">
        {queue.length === 0 && <p className="text-sm text-slate-400">No patients waiting. Check them in from <a href="/appointments" className="text-rose-700 underline">Appointments</a>.</p>}
        {queue.map((b) => {
          const wait = waited(b.checkedInAt);
          return (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" title="Queue token">{b.queueToken ?? "—"}</span>
                <div>
                  <div className="font-medium">{b.startTime} · {b.patient.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{b.doctor.name} · {b.department.name} · {b.bookingRef}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {wait && <span className="text-xs text-slate-500 dark:text-slate-400" title="Waiting time">waited {wait}</span>}
                <Badge tone="amber">{b.status.replace(/_/g, " ")}</Badge>
                <LinkButton href={`/consultations/${b.id}`}>Consult</LinkButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

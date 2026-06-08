import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { layoutCalendar, type CalendarItem } from "@prm/core";
import { PageHeader, LinkButton } from "@/components/ui";
import { CalendarGrid } from "@/components/appointments/CalendarGrid";

export const dynamic = "force-dynamic";

type View = "doctor" | "room" | "branch" | "week";
const VIEWS: { key: View; label: string }[] = [
  { key: "doctor", label: "By doctor" },
  { key: "room", label: "By room" },
  { key: "branch", label: "By branch" },
  { key: "week", label: "Week (doctor)" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const slotState = (s: { status: string; bookedCount: number; capacity: number }): CalendarItem["state"] =>
  s.status === "blocked" ? "blocked" : s.bookedCount >= s.capacity ? "full" : s.bookedCount > 0 ? "booked" : "open";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string; doctorId?: string }> }) {
  await requireCan("appointments", "view");
  const sp = await searchParams;
  const view = (["doctor", "room", "branch", "week"].includes(sp.view ?? "") ? sp.view : "doctor") as View;
  const dateStr = sp.date ?? iso(new Date());
  const date = new Date(dateStr);

  const [doctors, branches, rooms] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.consultationRoom.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  let items: CalendarItem[] = [];
  let columnLabels: Record<string, string> = {};
  let columnOrder: string[] = [];

  if (view === "room") {
    // Room view is slot-centric: the day's generated slots grouped by assigned room
    // (reflects the real room allotment grid).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slots = await prisma.timeSlot.findMany({ where: { slotDate: date, roomId: { not: null } } as any, include: { doctor: true }, orderBy: { startTime: "asc" } });
    items = slots.map((s) => ({ id: s.id, column: s.roomId as string, startTime: s.startTime, endTime: s.endTime, state: slotState(s), label: `${s.doctor?.name ?? ""} ${s.bookedCount}/${s.capacity}`, href: s.status !== "blocked" && s.bookedCount < s.capacity ? `/appointments/book?slotId=${s.id}` : undefined }));
    columnLabels = Object.fromEntries(rooms.map((r) => [r.id, r.purpose && r.purpose !== "consultation" ? `${r.name} · ${r.purpose.replace(/_/g, " ")}` : r.name]));
    columnOrder = rooms.map((r) => r.id);
  } else if (view === "week") {
    const doctorId = sp.doctorId ?? doctors[0]?.id;
    const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i); return iso(d); });
    const slots = doctorId ? await prisma.timeSlot.findMany({ where: { doctorId, slotDate: { gte: new Date(weekDates[0]), lte: new Date(weekDates[6]) } }, orderBy: { startTime: "asc" } }) : [];
    items = slots.map((s) => ({ id: s.id, column: iso(s.slotDate as Date), startTime: s.startTime, endTime: s.endTime, state: slotState(s), label: `${s.bookedCount}/${s.capacity}`, href: s.status !== "blocked" && s.bookedCount < s.capacity ? `/appointments/book?slotId=${s.id}` : undefined }));
    columnLabels = Object.fromEntries(weekDates.map((d) => [d, new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })]));
    columnOrder = weekDates;
  } else {
    // doctor or branch view — slot-centric for the chosen date.
    const slots = await prisma.timeSlot.findMany({ where: { slotDate: date }, include: { doctor: true }, orderBy: { startTime: "asc" } });
    const colOf = (s: { doctorId: string; branchId: string | null }) => (view === "branch" ? (s.branchId ?? "—") : s.doctorId);
    items = slots.map((s) => ({ id: s.id, column: colOf(s), startTime: s.startTime, endTime: s.endTime, state: slotState(s), label: `${s.bookedCount}/${s.capacity}`, href: s.status !== "blocked" && s.bookedCount < s.capacity ? `/appointments/book?slotId=${s.id}` : undefined }));
    if (view === "branch") { columnLabels = { "—": "Unassigned", ...Object.fromEntries(branches.map((b) => [b.id, b.name])) }; columnOrder = branches.map((b) => b.id); }
    else {
      const roleSuffix = (role: string | null) => (role === "cmo" ? " · CMO" : role === "chief_physician" ? " · Chief" : role === "dy_chief_physician" ? " · Dy Chief" : "");
      columnLabels = Object.fromEntries(doctors.map((d) => [d.id, `${d.name}${roleSuffix(d.role ?? null)}`]));
      columnOrder = doctors.map((d) => d.id);
    }
  }

  const layout = layoutCalendar(items, columnOrder);
  const pill = (active: boolean) => `rounded-full px-3 py-1 text-sm ${active ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ date: dateStr, view, ...(sp.doctorId ? { doctorId: sp.doctorId } : {}), ...extra }).toString();

  return (
    <div>
      <PageHeader title="Doctor calendar" subtitle={`Slots on ${dateStr}`} action={<LinkButton href="/appointments/schedules" tone="ghost">Schedules →</LinkButton>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => <Link key={v.key} href={`/appointments/calendar?${qs({ view: v.key })}`} className={pill(view === v.key)}>{v.label}</Link>)}
        <form action="/appointments/calendar" className="ml-auto flex items-end gap-2">
          <input type="hidden" name="view" value={view} />
          {view === "week" && (
            <select name="doctorId" defaultValue={sp.doctorId ?? doctors[0]?.id} className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800">
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <input type="date" name="date" defaultValue={dateStr} className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800" />
          <button className="rounded-md bg-slate-700 px-3 py-1 text-sm font-medium text-white">Go</button>
        </form>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />open</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" />booked</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-gold-500" />full</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />blocked</span>
      </div>

      <CalendarGrid layout={layout} columnLabels={columnLabels} />
    </div>
  );
}

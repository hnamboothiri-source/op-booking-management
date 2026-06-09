import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { layoutCalendar, slotUtilisation, type CalendarItem } from "@prm/core";
import { daySlots, type DaySlotCell } from "@/lib/appointments/slots";
import { PageHeader, LinkButton } from "@/components/ui";
import { CalendarGrid } from "@/components/appointments/CalendarGrid";
import { DayAgenda, type AgendaDoctor } from "@/components/appointments/DayAgenda";

export const dynamic = "force-dynamic";

type View = "agenda" | "doctor" | "room" | "branch" | "week";
const VIEWS: { key: View; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "doctor", label: "Grid · doctor" },
  { key: "room", label: "Grid · room" },
  { key: "branch", label: "Grid · branch" },
  { key: "week", label: "Week" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const ROLE = (r?: string | null) => (r === "cmo" ? "CMO" : r === "chief_physician" ? "Chief" : r === "dy_chief_physician" ? "Dy Chief" : "");
const cellId = (c: DaySlotCell, col?: string) => `${col ?? ""}-${c.doctorId}-${c.startTime}-${c.roomId ?? ""}`;
const cellState = (c: DaySlotCell): CalendarItem["state"] => (c.booked ? "booked" : "open");
const bookHref = (c: DaySlotCell, dateStr: string) =>
  c.bookingId ? `/appointments/${c.bookingId}` : `/appointments/book?doctorId=${c.doctorId}&date=${dateStr}&startTime=${c.startTime}`;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string; doctorId?: string }> }) {
  await requireCan("appointments", "view");
  const sp = await searchParams;
  const view = (["agenda", "doctor", "room", "branch", "week"].includes(sp.view ?? "") ? sp.view : "agenda") as View;
  const dateStr = sp.date ?? iso(new Date());
  const date = new Date(dateStr);

  const [doctors, branches, rooms] = await Promise.all([
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.consultationRoom.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const docName = (id: string) => doctors.find((d) => d.id === id)?.name ?? id;

  const pill = (active: boolean) => `rounded-full px-3 py-1 text-sm ${active ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ date: dateStr, view, ...(sp.doctorId ? { doctorId: sp.doctorId } : {}), ...extra }).toString();

  const header = (
    <>
      <PageHeader title="Doctor calendar" subtitle={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })} · derived from the master schedule`} action={<LinkButton href="/appointments/board" tone="ghost">Booking board →</LinkButton>} />
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
    </>
  );

  // ---- Agenda (default): per-doctor cards derived from the master schedule ----
  if (view === "agenda") {
    const { cells } = await daySlots(dateStr);
    const byDoctor = new Map<string, DaySlotCell[]>();
    for (const c of cells) (byDoctor.get(c.doctorId) ?? byDoctor.set(c.doctorId, []).get(c.doctorId)!).push(c);

    const agenda: AgendaDoctor[] = [...byDoctor.entries()].map(([docId, ds]) => {
      const sorted = [...ds].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const booked = sorted.filter((c) => c.booked).length;
      const sub = sorted[0].substituteFor;
      return {
        id: docId, name: docName(docId) + (sub ? ` (covering ${docName(sub)})` : ""), role: doctors.find((d) => d.id === docId)?.role ?? null,
        room: roomName.get(sorted[0].roomId ?? "") ?? null,
        windowLabel: `${sorted[0].startTime}–${sorted[sorted.length - 1].endTime}`,
        allotted: sorted.length, booked, utilisation: slotUtilisation(booked, sorted.length),
        slots: sorted.map((c) => ({ id: cellId(c), startTime: c.startTime, endTime: c.endTime, status: c.booked ? (c.bookingStatus ?? "booked") : "open", patientName: c.patientName ?? null, href: bookHref(c, dateStr) })),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return <div>{header}<DayAgenda doctors={agenda} doctorHref={(id) => `/appointments/doctor/${id}?date=${dateStr}`} /></div>;
  }

  // ---- Grid views (all derived) ----
  let items: CalendarItem[] = [];
  let columnLabels: Record<string, string> = {};
  let columnOrder: string[] = [];

  if (view === "week") {
    const doctorId = sp.doctorId ?? doctors[0]?.id;
    const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i); return iso(d); });
    const perDay = await Promise.all(weekDates.map((d) => daySlots(d)));
    weekDates.forEach((d, i) => {
      for (const c of perDay[i].cells.filter((x) => x.doctorId === doctorId)) {
        items.push({ id: cellId(c, d), column: d, startTime: c.startTime, endTime: c.endTime, state: cellState(c), label: c.patientName ?? "open", href: bookHref(c, d) });
      }
    });
    columnLabels = Object.fromEntries(weekDates.map((d) => [d, new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })]));
    columnOrder = weekDates;
  } else {
    const { cells } = await daySlots(dateStr);
    const colOf = (c: DaySlotCell) => (view === "room" ? (c.roomId ?? "—") : view === "branch" ? (c.branchId ?? "—") : c.doctorId);
    items = cells.map((c) => ({
      id: cellId(c, colOf(c)), column: colOf(c), startTime: c.startTime, endTime: c.endTime, state: cellState(c),
      label: c.patientName ?? (view === "doctor" ? "open" : `${docName(c.doctorId)}`),
      href: bookHref(c, dateStr),
    }));
    if (view === "room") { columnLabels = { "—": "Unassigned", ...Object.fromEntries(rooms.map((r) => [r.id, r.purpose && r.purpose !== "consultation" ? `${r.name} · ${r.purpose.replace(/_/g, " ")}` : r.name])) }; columnOrder = rooms.map((r) => r.id); }
    else if (view === "branch") { columnLabels = { "—": "Unassigned", ...Object.fromEntries(branches.map((b) => [b.id, b.name])) }; columnOrder = branches.map((b) => b.id); }
    else { columnLabels = Object.fromEntries(doctors.map((d) => [d.id, ROLE(d.role) ? `${d.name} · ${ROLE(d.role)}` : d.name])); columnOrder = doctors.map((d) => d.id); }
  }

  const layout = layoutCalendar(items, columnOrder);
  return (
    <div>
      {header}
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />open</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" />booked</span>
      </div>
      <CalendarGrid layout={layout} columnLabels={columnLabels} />
    </div>
  );
}

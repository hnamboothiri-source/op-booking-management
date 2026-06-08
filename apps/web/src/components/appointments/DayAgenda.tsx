import Link from "next/link";

export interface AgendaSlot {
  id: string;
  startTime: string;
  endTime: string;
  status: string; // open | booked | confirmed | arrived | waiting | in_consultation | completed | no_show | blocked | full
  patientName?: string | null;
  href?: string;
}
export interface AgendaDoctor {
  id: string;
  name: string;
  role?: string | null;
  room?: string | null;
  windowLabel?: string | null;
  allotted: number;
  booked: number;
  utilisation: number;
  slots: AgendaSlot[];
}

const TONE: Record<string, string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  booked: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  confirmed: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300",
  arrived: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  waiting: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  in_consultation: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  completed: "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
  no_show: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  full: "border-gold-300 bg-gold-100 text-gold-700 dark:border-gold-700 dark:bg-gold-700/30 dark:text-gold-300",
  blocked: "border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500",
};
const ROLE = (r?: string | null) => (r === "cmo" ? "CMO" : r === "chief_physician" ? "Chief" : r === "dy_chief_physician" ? "Dy Chief" : r === "consultant" ? "Consultant" : r === "medical_officer" ? "MO" : "");

/**
 * Per-doctor day agenda: each doctor is a card with a session header (role · room ·
 * hours · used/allotted + utilisation bar) and their slots top-to-bottom, each
 * showing time · patient (or "Open") · status.
 */
export function DayAgenda({ doctors, doctorHref }: { doctors: AgendaDoctor[]; doctorHref?: (id: string) => string }) {
  if (doctors.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No slots for this day. Generate slots on the Schedules page.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {doctors.map((d) => (
        <div key={d.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-slate-800 dark:text-slate-100">
                {doctorHref ? <Link href={doctorHref(d.id)} className="hover:text-rose-700 hover:underline dark:hover:text-rose-300">{d.name}</Link> : d.name}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">{ROLE(d.role)}</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{[d.room, d.windowLabel].filter(Boolean).join(" · ")}</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${d.utilisation}%` }} />
              </div>
              <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">{d.booked}/{d.allotted} · {d.utilisation}%</span>
            </div>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {d.slots.map((s) => {
              const cls = `flex items-center justify-between gap-2 px-4 py-2 text-sm ${s.href ? "cursor-pointer" : ""}`;
              const inner = (
                <>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{s.startTime}</span>
                  <span className="flex-1 truncate px-2 text-slate-700 dark:text-slate-200">{s.patientName ?? <span className="text-slate-400">Open</span>}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${TONE[s.status] ?? TONE.open}`}>{s.status.replace(/_/g, " ")}</span>
                </>
              );
              return s.href ? <li key={s.id}><Link href={s.href} className={`${cls} hover:bg-slate-50 dark:hover:bg-slate-900`}>{inner}</Link></li> : <li key={s.id} className={cls}>{inner}</li>;
            })}
            {d.slots.length === 0 && <li className="px-4 py-3 text-center text-xs text-slate-400">No slots.</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

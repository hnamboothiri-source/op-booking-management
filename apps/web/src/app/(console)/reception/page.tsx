import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { branchScopeWhere } from "@prm/core";
import { Card, SubmitButton } from "@/components/ui";
import { WorkDesk } from "@/components/workdesk/WorkDesk";
import { LeadQueue } from "@/components/callcenter/queues";
import { createLead, logMissedCall } from "@/lib/leads/actions";
import { walkInRegister, transitionBooking } from "@/lib/appointments/actions";

export const dynamic = "force-dynamic";
const OPEN_STAGES = ["new_lead", "contacted", "interested", "not_reachable", "appointment_suggested"];
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const lbl = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function ReceptionDesk() {
  const user = await requireCan("calls", "view");
  const scope = branchScopeWhere(user.role, user.branchId);
  const today = new Date(new Date().toISOString().slice(0, 10));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deskWhere: any = { ...scope, desk: "reception" };

  const [open, pending, phoneSource, doctors, departments, rooms, arrivals] = await Promise.all([
    prisma.lead.count({ where: { ...deskWhere, stage: { in: OPEN_STAGES } } }),
    prisma.lead.count({ where: { ...deskWhere, followUpDate: { lte: today }, stage: { in: ["contacted", "interested", "not_reachable", "appointment_suggested"] } } }),
    prisma.leadSourceMaster.findFirst({ where: { name: "phone" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.consultationRoom.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.findMany({ where: { ...scope, appointmentDate: today, status: { in: ["booked", "confirmed"] } } as any, include: { patient: true, doctor: true }, orderBy: { startTime: "asc" } }),
  ]);

  const capture = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 font-semibold">Log a walk-in / phone enquiry</h3>
        <form action={createLead} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="desk" value="reception" />
          <input type="hidden" name="sourceId" value={phoneSource?.id ?? ""} />
          <label className={lbl}>Name<input name="contactName" required className={input} /></label>
          <label className={lbl}>Phone<input name="phone" required className={input} /></label>
          <label className={`${lbl} sm:col-span-2`}>Preferred doctor<input name="preferredDoctor" className={input} /></label>
          <div className="sm:col-span-2"><SubmitButton>Log enquiry</SubmitButton></div>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Register a walk-in patient</h3>
        <form action={walkInRegister} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={lbl}>Patient MRD (blank = new)<input name="patientMrd" placeholder="MRD-…" className={input} /></label>
          <label className={lbl}>Name (if new)<input name="name" className={input} /></label>
          <label className={lbl}>Phone<input name="phone" className={input} /></label>
          <label className={lbl}>Doctor<select name="doctorId" required className={input}><option value="">— select —</option>{doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className={lbl}>Department<select name="departmentId" required className={input}><option value="">— select —</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className={lbl}>Room<select name="roomId" className={input}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className={`${lbl} sm:col-span-2`}>Chief complaint<input name="chiefComplaint" required placeholder="Why are they here?" className={input} /></label>
          <label className={lbl}>BP<input name="bp" placeholder="120/80" className={input} /></label>
          <label className={lbl}>Pulse (bpm)<input type="number" name="pulseBpm" className={input} /></label>
          <div className="sm:col-span-2"><SubmitButton>Register &amp; queue</SubmitButton></div>
        </form>
      </Card>

      <Card>
        <h3 className="mb-1 font-semibold">Log a missed call</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Creates a lead flagged as a missed enquiry and a callback task.</p>
        <form action={logMissedCall} className="flex flex-wrap items-end gap-3">
          <label className={lbl}>Phone<input name="phone" required className={input} /></label>
          <label className={lbl}>Name (optional)<input name="contactName" className={input} /></label>
          <SubmitButton tone="ghost">Log missed call</SubmitButton>
        </form>
      </Card>
    </div>
  );

  return (
    <WorkDesk
      title="Reception desk"
      subtitle="Inbound enquiry & booking + walk-in registration"
      action={<div className="flex gap-3 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Open: <strong>{open}</strong></span><span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Callbacks: <strong>{pending}</strong></span></div>}
      capture={capture}
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Expected arrivals today ({arrivals.length})</h2>
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <tbody>
            {arrivals.length === 0 && <tr><td className="px-4 py-4 text-center text-slate-400">No booked patients awaiting arrival.</td></tr>}
            {arrivals.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 dark:border-slate-700">
                <td className="px-4 py-2 font-medium">{b.startTime}</td>
                <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(b.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{b.patient?.name ?? b.patientMrd}</Link></td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{b.doctor?.name ?? "—"}</td>
                <td className="px-4 py-2 text-right"><form action={transitionBooking.bind(null, b.id, "arrived")}><button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Mark arrived</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LeadQueue title="Reception enquiries" where={{ ...deskWhere, stage: { in: OPEN_STAGES } }} />
    </WorkDesk>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, type DrillEntity, adherenceTone, therapyProgress, ADHERENCE_OPTIONS, ADHERENCE_LABELS, THERAPY_TYPE_OPTIONS, THERAPY_TYPE_LABELS, MED_REMINDER_LABELS, type Adherence, type TherapyType, type MedReminderKind } from "@prm/core";
import { setConsent } from "@/lib/communication/actions";
import { addPatientDocument, deletePatientDocument } from "@/lib/patients/actions";
import { prescribeMedicine, recordAdherence, completeCourse, discontinueCourse, sendMedicineReminder, createTherapyPlan, markSession } from "@/lib/engagement/actions";
import { PageHeader, Badge, Card, LinkButton, SubmitButton } from "@/components/ui";
import { DrillHeader } from "@/components/drill/DrillHeader";

const iso = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const fieldCls = "rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export const dynamic = "force-dynamic";

function Section({ title, children, drill }: { title: string; children: React.ReactNode; drill?: { entity: DrillEntity; mrd: string } }) {
  return (
    <div className="mb-6">
      {drill ? (
        <DrillHeader title={title} entity={drill.entity} filters={{ patientMrd: drill.mrd }} />
      ) : (
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      )}
      {children}
    </div>
  );
}

export default async function PatientDetail({ params }: { params: Promise<{ mrd: string }> }) {
  const { mrd } = await params;
  const user = await requireCan("patients", "view");
  const patient = await prisma.patient.findUnique({
    where: { mrd: decodeURIComponent(mrd) },
    include: {
      bookings: { include: { doctor: true, department: true }, orderBy: { appointmentDate: "desc" }, take: 20 },
      leads: { orderBy: { createdAt: "desc" }, take: 10 },
      followUps: { orderBy: { dueDate: "desc" }, take: 10 },
      communications: { orderBy: { createdAt: "desc" }, take: 10 },
      admissionRecs: { include: { package: true }, orderBy: { createdAt: "desc" }, take: 10 },
      referralsGiven: { orderBy: { createdAt: "desc" }, take: 10 },
      referralsGot: { orderBy: { createdAt: "desc" }, take: 10 },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!patient) notFound();

  // Engagement: query children separately (mock `include` won't hydrate reverse relations for created rows).
  const [courses, medReminders, plans, sessions] = await Promise.all([
    prisma.medicationCourse.findMany({ where: { patientMrd: patient.mrd }, orderBy: { createdAt: "desc" } }),
    prisma.medicationReminder.findMany({ where: { patientMrd: patient.mrd }, orderBy: { dueDate: "asc" } }),
    prisma.therapyPlan.findMany({ where: { patientMrd: patient.mrd }, orderBy: { createdAt: "desc" } }),
    prisma.therapySession.findMany({ where: { patientMrd: patient.mrd }, orderBy: { sessionNo: "asc" } }),
  ]);
  const canCare = can(user.role, "consultations", "edit");
  const canPrescribe = can(user.role, "consultations", "create");
  const canMessage = can(user.role, "communication", "create");
  const remindersByCourse = (id: string) => medReminders.filter((r) => r.courseId === id);
  const sessionsByPlan = (id: string) => sessions.filter((s) => s.planId === id);

  return (
    <div>
      <PageHeader
        title={patient.name}
        subtitle={`${patient.mrd} · ${patient.category.replace(/_/g, " ")}`}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/patients/${encodeURIComponent(patient.mrd)}/edit`} tone="ghost">Edit</LinkButton>
            <LinkButton href={`/patients/${encodeURIComponent(patient.mrd)}/timeline`} tone="ghost">Timeline</LinkButton>
            <LinkButton href={`/appointments/book?mrd=${encodeURIComponent(patient.mrd)}`}>Book appointment</LinkButton>
          </div>
        }
      />
      <div className="mb-6"><Link href="/patients" className="text-sm text-slate-500 hover:underline">← Patients</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500">Phone</div><div className="font-medium">{patient.phone ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500">Place</div><div className="font-medium">{patient.place ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500">Lifetime visits</div><div className="font-medium">{patient.lifetimeVisits}</div></Card>
        <Card><div className="text-xs text-slate-500">Lifetime revenue</div><div className="font-medium">₹{(patient.lifetimeRevenue / 100).toLocaleString("en-IN")}</div></Card>
      </div>

      {can(user.role, "patients", "edit") && (
        <Section title="Communication consent">
          <form action={setConsent.bind(null, patient.mrd)} className="flex flex-wrap items-center gap-4 rounded border border-slate-100 bg-white px-3 py-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="consentWhatsapp" defaultChecked={patient.consentWhatsapp} className="h-4 w-4" /> WhatsApp</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="consentSms" defaultChecked={patient.consentSms} className="h-4 w-4" /> SMS</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="consentEmail" defaultChecked={patient.consentEmail} className="h-4 w-4" /> Email</label>
            <SubmitButton>Save consent</SubmitButton>
          </form>
        </Section>
      )}

      <Section title={`Appointments (${patient.bookings.length})`} drill={{ entity: "appointments", mrd: patient.mrd }}>
        <div className="space-y-1">
          {patient.bookings.length === 0 && <p className="text-sm text-slate-400">None.</p>}
          {patient.bookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
              <span>{b.appointmentDate.toISOString().slice(0, 10)} · {b.startTime} · {b.doctor.name} ({b.department.name})</span>
              <Badge tone="blue">{b.status.replace(/_/g, " ")}</Badge>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Leads (${patient.leads.length})`} drill={{ entity: "leads", mrd: patient.mrd }}>
        {patient.leads.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.leads.map((l) => (
          <div key={l.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">{l.contactName} · {l.stage.replace(/_/g, " ")}</div>
        ))}
      </Section>

      <Section title={`Follow-ups (${patient.followUps.length})`} drill={{ entity: "followups", mrd: patient.mrd }}>
        {patient.followUps.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.followUps.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
            <span>{f.type.replace(/_/g, " ")} · due {f.dueDate.toISOString().slice(0, 10)}</span><Badge>{f.status}</Badge>
          </div>
        ))}
      </Section>

      <Section title={`Admission recommendations (${patient.admissionRecs.length})`} drill={{ entity: "admissions", mrd: patient.mrd }}>
        {patient.admissionRecs.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.admissionRecs.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
            <span>{a.package?.name ?? "Admission"}{a.estimatedCost ? ` · ₹${(a.estimatedCost / 100).toLocaleString("en-IN")}` : ""}</span><Badge tone={a.status === "admitted" ? "green" : a.status === "rejected" || a.status === "lost" ? "red" : "blue"}>{a.status}</Badge>
          </div>
        ))}
      </Section>

      <Section title={`Referrals (given ${patient.referralsGiven.length} · received ${patient.referralsGot.length})`} drill={{ entity: "referrals", mrd: patient.mrd }}>
        {patient.referralsGiven.length === 0 && patient.referralsGot.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
          <>
            {patient.referralsGiven.map((r) => <div key={r.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">Gave a {r.type.replace(/_/g, " ")} referral · {r.status}</div>)}
            {patient.referralsGot.map((r) => <div key={r.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">Was referred ({r.type.replace(/_/g, " ")}) · {r.status}</div>)}
          </>
        )}
      </Section>

      <Section title={`Communication (${patient.communications.length})`} drill={{ entity: "communications", mrd: patient.mrd }}>
        {patient.communications.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.communications.map((c) => (
          <div key={c.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">{c.channel} → {c.toAddress} · {c.status}</div>
        ))}
      </Section>

      <Section title={`Medicines & adherence (${courses.length})`}>
        {canPrescribe && (
          <form action={prescribeMedicine.bind(null, patient.mrd)} className="mb-3 flex flex-wrap items-end gap-2">
            <input name="medicine" placeholder="Medicine (e.g. Triphala Churna)" required className={`${fieldCls} w-56`} />
            <label className="text-xs text-slate-500">Days<input type="number" name="durationDays" defaultValue={30} min={1} className={`${fieldCls} ml-1 w-20`} /></label>
            <label className="text-xs text-slate-500">Start<input type="date" name="startDate" defaultValue={iso(new Date())} className={`${fieldCls} ml-1`} /></label>
            <input name="notes" placeholder="Dosage / notes" className={`${fieldCls} w-48`} />
            <SubmitButton>Prescribe</SubmitButton>
          </form>
        )}
        {courses.length === 0 ? <p className="text-sm text-slate-400">No medicines prescribed.</p> : (
          <div className="space-y-2">
            {courses.map((c) => {
              const nextDue = remindersByCourse(c.id as string).find((r) => r.status === "scheduled");
              return (
                <div key={c.id as string} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{c.medicine as string} <span className="text-xs font-normal text-slate-400">· {c.durationDays as number}d · from {iso(c.startDate as Date)}</span></span>
                    <span className="flex items-center gap-2">
                      <Badge tone={adherenceTone(c.adherence as Adherence)}>{ADHERENCE_LABELS[c.adherence as Adherence]}</Badge>
                      <Badge tone={c.status === "active" ? "blue" : c.status === "completed" ? "green" : "slate"}>{c.status as string}</Badge>
                    </span>
                  </div>
                  {c.notes ? <div className="mt-0.5 text-xs text-slate-500">{c.notes as string}</div> : null}
                  <div className="mt-1 text-xs text-slate-500">
                    {nextDue ? <>Next: <strong>{MED_REMINDER_LABELS[nextDue.kind as MedReminderKind]}</strong> due {iso(nextDue.dueDate as Date)}</> : "All reminders sent."}
                  </div>
                  {(canCare || canMessage) && (c.status as string) === "active" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {canMessage && nextDue && (
                        <form action={sendMedicineReminder.bind(null, nextDue.id as string)}><SubmitButton tone="ghost">Send {MED_REMINDER_LABELS[nextDue.kind as MedReminderKind].toLowerCase()}</SubmitButton></form>
                      )}
                      {canCare && (
                        <form action={recordAdherence.bind(null, c.id as string, patient.mrd)} className="flex items-center gap-1">
                          <select name="adherence" defaultValue={c.adherence as string} className={fieldCls}>
                            {ADHERENCE_OPTIONS.map((a) => <option key={a} value={a}>{ADHERENCE_LABELS[a]}</option>)}
                          </select>
                          <SubmitButton tone="ghost">Save response</SubmitButton>
                        </form>
                      )}
                      {canCare && <form action={completeCourse.bind(null, c.id as string, patient.mrd)}><SubmitButton tone="ghost">Complete</SubmitButton></form>}
                      {canCare && <form action={discontinueCourse.bind(null, c.id as string, patient.mrd)}><SubmitButton tone="danger">Discontinue</SubmitButton></form>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={`Therapies (${plans.length})`}>
        {canPrescribe && (
          <form action={createTherapyPlan.bind(null, patient.mrd)} className="mb-3 flex flex-wrap items-end gap-2">
            <select name="therapyType" className={fieldCls}>{THERAPY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{THERAPY_TYPE_LABELS[t]}</option>)}</select>
            <input name="name" placeholder="Name (optional)" className={`${fieldCls} w-40`} />
            <label className="text-xs text-slate-500">Sessions<input type="number" name="totalSessions" defaultValue={10} min={1} className={`${fieldCls} ml-1 w-20`} /></label>
            <label className="text-xs text-slate-500">Every (days)<input type="number" name="intervalDays" defaultValue={3} min={1} className={`${fieldCls} ml-1 w-20`} /></label>
            <label className="text-xs text-slate-500">Start<input type="date" name="startDate" defaultValue={iso(new Date())} className={`${fieldCls} ml-1`} /></label>
            <SubmitButton>Add therapy</SubmitButton>
          </form>
        )}
        {plans.length === 0 ? <p className="text-sm text-slate-400">No therapies planned.</p> : (
          <div className="space-y-3">
            {plans.map((p) => {
              const ps = sessionsByPlan(p.id as string);
              const prog = therapyProgress(p.totalSessions as number, ps.filter((s) => s.status === "completed").length, ps.filter((s) => s.status === "missed").length);
              return (
                <div key={p.id as string} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{THERAPY_TYPE_LABELS[p.therapyType as TherapyType]}{p.name ? ` · ${p.name as string}` : ""}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={prog.missed > 0 ? "amber" : prog.pct === 100 ? "green" : "blue"}>{prog.completed}/{p.totalSessions as number} done</Badge>
                      <Badge tone={p.status === "completed" ? "green" : p.status === "in_progress" ? "blue" : "slate"}>{(p.status as string).replace(/_/g, " ")}</Badge>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-700"><div className="h-full bg-gradient-to-r from-rose-600 to-gold-500" style={{ width: `${prog.pct}%` }} /></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ps.map((s) => (
                      <div key={s.id as string} className="flex items-center gap-1 rounded border border-slate-100 px-1.5 py-0.5 text-xs dark:border-slate-700">
                        <span className="text-slate-400">#{s.sessionNo as number}</span>
                        <span>{iso(s.scheduledDate as Date)}</span>
                        <Badge tone={s.status === "completed" ? "green" : s.status === "missed" ? "amber" : s.status === "cancelled" ? "slate" : "blue"}>{s.status as string}</Badge>
                        {canCare && (s.status as string) === "scheduled" && (
                          <>
                            <form action={markSession.bind(null, s.id as string, "completed", patient.mrd)}><button className="text-emerald-600 hover:underline">✓</button></form>
                            <form action={markSession.bind(null, s.id as string, "missed", patient.mrd)}><button className="text-amber-600 hover:underline">✕</button></form>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={`Documents & reports (${patient.documents.length})`}>
        {can(user.role, "patients", "edit") && (
          <form action={addPatientDocument.bind(null, patient.mrd)} className="mb-2 flex flex-wrap items-end gap-2">
            <input name="label" placeholder="Label (e.g. Scan report)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <input name="url" placeholder="https://…" className="w-72 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <SubmitButton>Add document</SubmitButton>
          </form>
        )}
        {patient.documents.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline dark:text-rose-300">{d.label}</a>
            {can(user.role, "patients", "edit") && <form action={deletePatientDocument.bind(null, d.id, patient.mrd)}><button className="text-xs text-red-500 hover:underline">remove</button></form>}
          </div>
        ))}
      </Section>
    </div>
  );
}

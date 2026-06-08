import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { can, type DrillEntity } from "@prm/core";
import { setConsent } from "@/lib/communication/actions";
import { addPatientDocument, deletePatientDocument } from "@/lib/patients/actions";
import { PageHeader, Badge, Card, LinkButton, SubmitButton } from "@/components/ui";
import { DrillHeader } from "@/components/drill/DrillHeader";

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

  return (
    <div>
      <PageHeader
        title={patient.name}
        subtitle={`${patient.mrd} · ${patient.category.replace(/_/g, " ")}`}
        action={
          <div className="flex gap-2">
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
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">{d.label}</a>
            {can(user.role, "patients", "edit") && <form action={deletePatientDocument.bind(null, d.id, patient.mrd)}><button className="text-xs text-red-500 hover:underline">remove</button></form>}
          </div>
        ))}
      </Section>
    </div>
  );
}

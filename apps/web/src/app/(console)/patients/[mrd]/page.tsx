import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Badge, Card, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

export default async function PatientDetail({ params }: { params: Promise<{ mrd: string }> }) {
  const { mrd } = await params;
  await requireCan("patients", "view");
  const patient = await prisma.patient.findUnique({
    where: { mrd: decodeURIComponent(mrd) },
    include: {
      bookings: { include: { doctor: true, department: true }, orderBy: { appointmentDate: "desc" }, take: 20 },
      leads: { orderBy: { createdAt: "desc" }, take: 10 },
      followUps: { orderBy: { dueDate: "desc" }, take: 10 },
      communications: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!patient) notFound();

  return (
    <div>
      <PageHeader
        title={patient.name}
        subtitle={`${patient.mrd} · ${patient.category.replace(/_/g, " ")}`}
        action={<LinkButton href={`/appointments/book?mrd=${encodeURIComponent(patient.mrd)}`}>Book appointment</LinkButton>}
      />
      <div className="mb-6"><Link href="/patients" className="text-sm text-slate-500 hover:underline">← Patients</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500">Phone</div><div className="font-medium">{patient.phone ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500">Place</div><div className="font-medium">{patient.place ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500">Lifetime visits</div><div className="font-medium">{patient.lifetimeVisits}</div></Card>
        <Card><div className="text-xs text-slate-500">Lifetime revenue</div><div className="font-medium">₹{(patient.lifetimeRevenue / 100).toLocaleString("en-IN")}</div></Card>
      </div>

      <Section title={`Appointments (${patient.bookings.length})`}>
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

      <Section title={`Leads (${patient.leads.length})`}>
        {patient.leads.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.leads.map((l) => (
          <div key={l.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">{l.contactName} · {l.stage.replace(/_/g, " ")}</div>
        ))}
      </Section>

      <Section title={`Follow-ups (${patient.followUps.length})`}>
        {patient.followUps.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.followUps.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border border-slate-100 bg-white px-3 py-2 text-sm">
            <span>{f.type.replace(/_/g, " ")} · due {f.dueDate.toISOString().slice(0, 10)}</span><Badge>{f.status}</Badge>
          </div>
        ))}
      </Section>

      <Section title={`Communication (${patient.communications.length})`}>
        {patient.communications.length === 0 ? <p className="text-sm text-slate-400">None.</p> : patient.communications.map((c) => (
          <div key={c.id} className="rounded border border-slate-100 bg-white px-3 py-2 text-sm">{c.channel} → {c.toAddress} · {c.status}</div>
        ))}
      </Section>
    </div>
  );
}

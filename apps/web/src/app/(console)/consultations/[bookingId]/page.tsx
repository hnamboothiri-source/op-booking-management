import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createConsultation } from "@/lib/consultations/actions";
import { PageHeader, Card, SubmitButton, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";
const OUTCOMES = ["medicine_prescribed", "test_recommended", "follow_up_advised", "admission_advised", "surgery_or_procedure_advised", "referred_to_department", "no_treatment_required"];
const FU_TYPES = ["consultation_review", "medicine", "test", "admission", "surgery_procedure", "annual_checkup"];

export default async function ConsultPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  await requireCan("consultations", "create");
  const booking = await prisma.opBooking.findUnique({
    where: { id: bookingId },
    include: { patient: true, doctor: true, department: true, consultation: true },
  });
  if (!booking) notFound();

  const [diseases, packages] = await Promise.all([
    prisma.diseaseMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.admissionPackageMaster.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (booking.consultation) {
    return (
      <div>
        <PageHeader title="Consultation" subtitle={`${booking.patient.name} · ${booking.bookingRef}`} />
        <Card><p className="text-sm">A consultation is already recorded for this booking (outcome: <Badge tone="green">{booking.consultation.outcome.replace(/_/g, " ")}</Badge>).</p></Card>
        <div className="mt-4"><Link href={`/patients/${encodeURIComponent(booking.patientMrd)}`} className="text-sm text-rose-700 hover:underline dark:text-rose-300">View patient →</Link></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Consultation" subtitle={`${booking.patient.name} · ${booking.doctor.name} · ${booking.department.name}`} />
      <div className="mb-4"><Link href="/queue" className="text-sm text-slate-500 hover:underline">← Patient queue</Link></div>

      <form action={createConsultation.bind(null, bookingId)} className="max-w-3xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">Outcome *
            <select name="outcome" required className={input}>{OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>
          </label>
          <label className="text-sm font-medium text-slate-700">Diagnosis category
            <select name="diseaseId" className={input}><option value="">—</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Diagnosis<input name="diagnosis" className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">Advice<input name="advice" className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">Notes<textarea name="notes" rows={2} className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">Prescription summary (full Rx stays in HIS)<textarea name="prescriptionSummary" rows={2} className={input} /></label>

        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">Lab test referral<input name="labTest" placeholder="e.g. CBC, HbA1c" className={input} /></label>
          <label className="text-sm font-medium text-slate-700">Optometry referral (reason)<input name="optometryReason" className={input} /></label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Treatment plan<textarea name="treatmentPlan" rows={2} className={input} /></label>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">Follow-up recommendation</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm text-slate-700">Type<select name="followUpType" className={input}>{FU_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></label>
            <label className="text-sm text-slate-700">Due date<input type="date" name="followUpDate" className={input} /></label>
          </div>
        </Card>

        <Card>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="admissionRecommended" className="h-4 w-4" /> Recommend admission</label>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <label className="text-sm text-slate-700">Package<select name="packageId" className={input}><option value="">—</option>{packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="text-sm text-slate-700">Estimated cost (₹)<input type="number" step="0.01" name="estimatedCost" className={input} /></label>
          </div>
        </Card>

        <label className="block text-sm font-medium text-slate-700">Remarks for call centre / front office<input name="staffRemarks" className={input} /></label>

        <SubmitButton>Save consultation &amp; complete visit</SubmitButton>
      </form>
    </div>
  );
}

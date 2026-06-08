import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { transitionAdmission } from "@/lib/admissions/actions";
import { nextAdmissionStatuses, admissionNeedsReason, can, type AdmissionStatus } from "@prm/core";
import { PageHeader, Card, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const REJECTION_REASONS = ["cost_concern", "family_decision_pending", "seeking_second_opinion", "travel_difficulty", "fear_of_admission", "treatment_postponed", "chose_another_hospital"];
const TONE: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  recommended: "blue", counselled: "amber", interested: "amber", postponed: "slate", accepted: "green", admitted: "green", rejected: "red", lost: "red",
};

export default async function AdmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("admissions", "view");
  const a = await prisma.admissionRecommendation.findUnique({ where: { id }, include: { patient: true, package: true } });
  if (!a) notFound();
  const canEdit = can(user.role, "admissions", "edit");

  return (
    <div>
      <PageHeader title="Admission counselling" subtitle={`${a.patient?.name ?? a.patientMrd}`} action={<Badge tone={TONE[a.status]}>{a.status}</Badge>} />
      <div className="mb-6"><Link href="/admissions" className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Admissions</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Patient</div><div className="font-medium"><Link href={`/patients/${encodeURIComponent(a.patientMrd)}`} className="text-rose-700 hover:underline dark:text-rose-300">{a.patient?.name ?? a.patientMrd}</Link></div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Package</div><div className="font-medium">{a.package?.name ?? "—"}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Est. cost</div><div className="font-medium">{a.estimatedCost ? `₹${(a.estimatedCost / 100).toLocaleString("en-IN")}` : "—"}</div></Card>
        <Card><div className="text-xs text-slate-500 dark:text-slate-400">Status</div><div className="font-medium">{a.status}{a.rejectionReason ? ` · ${a.rejectionReason.replace(/_/g, " ")}` : ""}</div></Card>
      </div>

      {a.counsellingNotes && (
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Counselling</div>
          <p className="mt-1 text-sm">{a.counsellingNotes}{a.costDiscussed ? ` · cost discussed ₹${(a.costDiscussed / 100).toLocaleString("en-IN")}` : ""}</p>
        </Card>
      )}

      {canEdit && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Advance the funnel</h2>
          <div className="flex flex-wrap gap-2">
            {nextAdmissionStatuses(a.status as AdmissionStatus).map((s) =>
              admissionNeedsReason(s) ? (
                <form key={s} action={transitionAdmission.bind(null, a.id, s)} className="flex items-center gap-1">
                  <select name="rejectionReason" className="rounded border border-slate-300 px-1 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"><option value="">reason…</option>{REJECTION_REASONS.map((rr) => <option key={rr} value={rr}>{rr.replace(/_/g, " ")}</option>)}</select>
                  <button className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">{s}</button>
                </form>
              ) : s === "counselled" ? (
                <form key={s} action={transitionAdmission.bind(null, a.id, s)} className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <label className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-300">Counselling notes *<input name="counsellingNotes" required placeholder="What was discussed / patient response" className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Cost discussed (₹)<input type="number" name="costDiscussed" className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Next counselling<input type="date" name="nextCounsellingAt" className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800" /></label>
                  <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Mark counselled</button>
                </form>
              ) : (
                <form key={s} action={transitionAdmission.bind(null, a.id, s)}><button className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">{s}</button></form>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

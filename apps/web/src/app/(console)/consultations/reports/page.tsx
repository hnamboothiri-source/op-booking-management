import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { DrillStat } from "@/components/drill/DrillStat";
import { DrillCount } from "@/components/drill/DrillCount";

export const dynamic = "force-dynamic";
const humanize = (s: string) => s.replace(/_/g, " ");
const OUTCOMES = ["medicine_prescribed", "test_recommended", "follow_up_advised", "admission_advised", "surgery_or_procedure_advised", "referred_to_department", "no_treatment_required"];

export default async function ConsultationReports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireCan("consultations", "view");
  const { from, to } = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dateWhere: any = {};
  if (from) dateWhere.gte = new Date(from);
  if (to) dateWhere.lte = new Date(`${to}T23:59:59`);
  const where = from || to ? { createdAt: dateWhere } : {};

  const [consults, doctors, diseases, departments, admissionRecs, followUpRecs] = await Promise.all([
    prisma.consultation.findMany({ where, select: { doctorId: true, diseaseId: true, outcome: true, patientMrd: true, referredDepartmentId: true } }),
    prisma.doctor.findMany(),
    prisma.diseaseMaster.findMany(),
    prisma.department.findMany(),
    prisma.admissionRecommendation.count({ where: from || to ? { createdAt: dateWhere } : {} }),
    prisma.followUp.count({ where: { consultationId: { not: null }, ...(from || to ? { createdAt: dateWhere } : {}) } }),
  ]);
  const docName = (id: string) => doctors.find((d) => d.id === id)?.name ?? id;
  const disName = (id: string | null) => (id ? diseases.find((d) => d.id === id)?.name ?? id : "Uncategorised");
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;

  // Aggregate in-memory (mock-safe, small data).
  const byDoctor = new Map<string, number>();
  const byOutcome = new Map<string, number>();
  const diseasePatients = new Map<string, Set<string>>();
  const pattern = new Map<string, number>(); // `${doctorId}|${deptId}` → count
  for (const c of consults) {
    byDoctor.set(c.doctorId, (byDoctor.get(c.doctorId) ?? 0) + 1);
    byOutcome.set(c.outcome, (byOutcome.get(c.outcome) ?? 0) + 1);
    const key = c.diseaseId ?? "—";
    (diseasePatients.get(key) ?? diseasePatients.set(key, new Set()).get(key)!).add(c.patientMrd);
    if (c.referredDepartmentId) { const k = `${c.doctorId}|${c.referredDepartmentId}`; pattern.set(k, (pattern.get(k) ?? 0) + 1); }
  }
  const total = consults.length;
  const inputCls = "rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800";
  const sortDesc = <T,>(m: Map<T, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader title="Consultation reports" subtitle="Doctor, diagnosis, outcome, referral pattern & recommendations" action={<LinkButton href="/consultations" tone="ghost">← Consultations</LinkButton>} />

      <form className="mb-6 flex flex-wrap items-end gap-2 text-sm">
        <label className="text-slate-500">From<input type="date" name="from" defaultValue={from ?? ""} className={`ml-2 ${inputCls}`} /></label>
        <label className="text-slate-500">To<input type="date" name="to" defaultValue={to ?? ""} className={`ml-2 ${inputCls}`} /></label>
        <button className="rounded-md bg-slate-700 px-3 py-1.5 font-medium text-white">Apply</button>
        {(from || to) && <LinkButton href="/consultations/reports" tone="ghost">Clear</LinkButton>}
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DrillStat label="Consultations" value={total} entity="consultations" filters={{}} />
        <DrillStat label="Admission recs" value={admissionRecs} entity="admissions" filters={{}} />
        <Card><div className="text-2xl font-bold">{followUpRecs}</div><div className="text-xs text-slate-500 dark:text-slate-400">Follow-up recs (from consultations)</div></Card>
        <Card><div className="text-2xl font-bold">{diseasePatients.size}</div><div className="text-xs text-slate-500 dark:text-slate-400">Diagnosis categories</div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportTable title="Doctor-wise consultations" rows={sortDesc(byDoctor).map(([id, n]) => ({ label: docName(id), value: <DrillCount value={n} entity="consultations" filters={{ doctorId: id }} label={`${docName(id)} · consultations`} /> }))} />
        <ReportTable title="Outcome breakdown" rows={OUTCOMES.map((o) => ({ label: humanize(o), value: <DrillCount value={byOutcome.get(o) ?? 0} entity="consultations" filters={{ outcome: o }} label={`Consultations · ${humanize(o)}`} /> }))} />
        <ReportTable title="Diagnosis-wise patients" rows={sortDesc(new Map([...diseasePatients].map(([k, set]) => [k, set.size] as [string, number]))).map(([id, n]) => ({ label: disName(id === "—" ? null : id), value: id === "—" ? n : <DrillCount value={n} entity="consultations" filters={{ diseaseId: id }} label={`Consultations · ${disName(id)}`} /> }))} />
        <ReportTable title="Doctor referral pattern" rows={sortDesc(pattern).map(([k, n]) => { const [docId, deptId] = k.split("|"); return { label: `${docName(docId)} → ${deptName(deptId)}`, value: n }; })} empty="No internal referrals recorded." />
      </div>
    </div>
  );
}

function ReportTable({ title, rows, empty }: { title: string; rows: { label: string; value: React.ReactNode }[]; empty?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.length === 0 && <tr><td className="px-4 py-3 text-slate-400">{empty ?? "No data."}</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
              <td className="px-4 py-2">{r.label}</td>
              <td className="px-4 py-2 text-right font-medium">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updatePatient } from "@/lib/patients/actions";
import { PageHeader, Card, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export default async function PatientEdit({ params }: { params: Promise<{ mrd: string }> }) {
  const { mrd: raw } = await params;
  const mrd = decodeURIComponent(raw);
  await requireCan("patients", "edit");
  const p = await prisma.patient.findUnique({ where: { mrd } });
  if (!p) notFound();

  return (
    <div>
      <PageHeader title={`Edit · ${p.name}`} subtitle={mrd} />
      <div className="mb-6"><Link href={`/patients/${encodeURIComponent(mrd)}`} className="text-sm text-slate-500 hover:underline dark:text-slate-400">← Patient</Link></div>

      <Card>
        <form action={updatePatient.bind(null, mrd)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Name<input name="name" defaultValue={p.name} className={input} /></label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Phone<input name="phone" defaultValue={p.phone ?? ""} className={input} /></label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">WhatsApp<input name="whatsapp" defaultValue={p.whatsapp ?? ""} className={input} /></label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email<input name="email" defaultValue={p.email ?? ""} className={input} /></label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Place<input name="place" defaultValue={p.place ?? ""} className={input} /></label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Occupation<input name="occupation" defaultValue={p.occupation ?? ""} className={input} /></label>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">Address<input name="address" defaultValue={p.address ?? ""} className={input} /></label>
          <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
        </form>
      </Card>
    </div>
  );
}

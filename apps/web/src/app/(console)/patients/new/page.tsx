import Link from "next/link";
import { requireCan } from "@/lib/session";
import { createPatient } from "@/lib/patients/actions";
import { PageHeader, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export default async function NewPatient() {
  await requireCan("patients", "create");
  return (
    <div>
      <PageHeader title="New patient" subtitle="Local cache of the HIS patient master" />
      <div className="mb-4"><Link href="/patients" className="text-sm text-slate-500 hover:underline">← Patients</Link></div>
      <form action={createPatient} className="grid max-w-2xl grid-cols-2 gap-4">
        <label className="text-sm font-medium text-slate-700">Name *<input name="name" required className={input} /></label>
        <label className="text-sm font-medium text-slate-700">MRD (blank = auto)<input name="mrd" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Phone<input name="phone" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">WhatsApp<input name="whatsapp" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Email<input name="email" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Gender
          <select name="gender" className={input}><option value="">—</option><option value="male">male</option><option value="female">female</option><option value="other">other</option></select>
        </label>
        <label className="text-sm font-medium text-slate-700">Place<input name="place" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Occupation<input name="occupation" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">Language<input name="languagePref" className={input} /></label>
        <label className="text-sm font-medium text-slate-700">First-visit source<input name="firstVisitSource" className={input} /></label>
        <label className="col-span-2 text-sm font-medium text-slate-700">Address<input name="address" className={input} /></label>
        <div className="col-span-2"><SubmitButton>Create patient</SubmitButton></div>
      </form>
    </div>
  );
}

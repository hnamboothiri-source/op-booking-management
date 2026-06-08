import { loginWithPassword } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

// Prototype: pick a role to explore the app as. No password.
const ROLES: { role: string; label: string; blurb: string }[] = [
  { role: "administrator", label: "Administrator", blurb: "Full access — every module" },
  { role: "call_center_executive", label: "Call Centre", blurb: "Leads, calls, appointments" },
  { role: "doctor", label: "Doctor", blurb: "Queue, consultations, patients" },
  { role: "front_office", label: "Front Office", blurb: "Appointments, patients" },
  { role: "admission_counsellor", label: "Admission Counsellor", blurb: "Admissions, follow-ups" },
  { role: "patient_success_executive", label: "Patient Success", blurb: "Retention, follow-ups" },
];

export default async function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-700 to-gold-500 text-lg font-bold text-white">S</span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">Sreedhareeyam Ayurveda Hospital</p>
          <p className="text-xs text-slate-400">Patient Relationship Management · Prototype</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="h-1 bg-gradient-to-r from-rose-700 to-gold-500" />
        <div className="p-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Choose a role to explore</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This is a clickable prototype — pick any role. No password needed; data is sample data.</p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {ROLES.map((r) => (
              <form key={r.role} action={loginWithPassword}>
                <input type="hidden" name="role" value={r.role} />
                <button type="submit" className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:border-rose-700 dark:hover:bg-rose-950/40">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{r.blurb}</div>
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

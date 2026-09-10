import { loginWithPassword, loginAsStaff } from "@/lib/auth-actions";
import { ensureCoreSync } from "@/lib/core-sync";
import { store } from "@/lib/mock/dataset";
import { getModuleBySlug } from "@/lib/modules/registry";
import { DottedAccent } from "@/components/DottedAccent";

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

// Seeded department managers — log in as a specific staff member so the confined,
// owned-module experience demos correctly.
function managerLogins() {
  return (store.staffUser ?? [])
    .filter((s) => Array.isArray(s.managedModules) && s.managedModules.length > 0)
    .map((s) => ({
      id: s.id as string,
      label: s.name as string,
      blurb: (s.managedModules as string[]).map((slug) => getModuleBySlug(slug)?.name ?? slug).join(" · "),
    }));
}

// Designation-hierarchy logins: one staff member per designation, sorted by
// level — demos how a session follows the job title (rights, approvals, pages).
function designationLogins() {
  const designations = (store.designation ?? []).filter((d) => d.active).sort((a, b) => a.level - b.level);
  const approverName = (d: Record<string, unknown>) => {
    const id = (d.approverDesignationId ?? d.reportsToDesignationId) as string | null;
    return id ? ((store.designation ?? []).find((x) => x.id === id)?.name as string) ?? null : null;
  };
  const out: { id: string; label: string; blurb: string }[] = [];
  for (const d of designations) {
    const holder = (store.staffUser ?? []).find((s) => s.designationId === d.id && s.active !== false);
    if (!holder) continue;
    const approver = approverName(d);
    out.push({
      id: holder.id as string,
      label: holder.name as string,
      blurb: `${d.name}${approver ? ` · authorised by ${approver}` : ""}`,
    });
  }
  return out;
}

// Org-scope logins: group (management), company managers and a centre manager —
// demos group / company / centre consolidation scopes.
function orgLogins() {
  const company = (id: string | null) => (store.company ?? []).find((c) => c.id === id)?.shortName ?? null;
  const branch = (id: string | null) => (store.branch ?? []).find((b) => b.id === id)?.name ?? null;
  return (store.staffUser ?? [])
    .filter((s) => s.role === "company_manager" || s.role === "branch_manager")
    .map((s) => ({
      id: s.id as string,
      label: s.name as string,
      blurb: s.role === "company_manager"
        ? `Company — ${company(s.companyId as string) ?? "all centres"}`
        : `Centre — ${branch(s.branchId as string) ?? "own centre"}`,
    }));
}

export default async function LoginPage() {
  await ensureCoreSync(); // hydrate central staff before building the login lists
  const managers = managerLogins();
  const orgUsers = orgLogins();
  const designationUsers = designationLogins();
  return (
    <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center overflow-hidden px-6 py-16">
      <DottedAccent className="opacity-60" />
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-gold-500 text-lg font-bold text-white">S</span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">Sreedhareeyam Ayurveda Hospital</p>
          <p className="text-xs text-slate-400">Patient Relationship Management · Prototype</p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="h-1 bg-gradient-to-r from-rose-600 to-gold-500" />
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

          {designationUsers.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Designations (hierarchy demo)</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Top to bottom — each session carries that designation&apos;s rights, approval powers &amp; authorizer.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {designationUsers.map((m) => (
                  <form key={m.id} action={loginAsStaff}>
                    <input type="hidden" name="staffId" value={m.id} />
                    <button type="submit" className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:border-rose-700 dark:hover:bg-rose-950/40">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{m.blurb}</div>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}

          {orgUsers.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Group &amp; company managers</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Company-wide or single-centre consolidation scope.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {orgUsers.map((m) => (
                  <form key={m.id} action={loginAsStaff}>
                    <input type="hidden" name="staffId" value={m.id} />
                    <button type="submit" className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:border-rose-700 dark:hover:bg-rose-950/40">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{m.blurb}</div>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}

          {managers.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Department managers</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Confined to the modules they manage.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {managers.map((m) => (
                  <form key={m.id} action={loginAsStaff}>
                    <input type="hidden" name="staffId" value={m.id} />
                    <button type="submit" className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:border-rose-700 dark:hover:bg-rose-950/40">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{m.blurb}</div>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

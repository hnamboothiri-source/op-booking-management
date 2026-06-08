import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { can, type Resource } from "@prm/core";
import { DrillProvider } from "@/components/drill/DrillProvider";

// Nav items with an implemented route, shown when the role can view the resource.
const NAV: { href: string; label: string; resource: Resource }[] = [
  { href: "/", label: "Dashboard", resource: "dashboards" },
  { href: "/leads", label: "Leads", resource: "leads" },
  { href: "/call-center", label: "Call Center", resource: "calls" },
  { href: "/prioritize", label: "Prioritize", resource: "calls" },
  { href: "/appointments", label: "Appointments", resource: "appointments" },
  { href: "/waitlist", label: "Waitlist", resource: "appointments" },
  { href: "/queue", label: "Queue", resource: "consultations" },
  { href: "/consultations", label: "Consultations", resource: "consultations" },
  { href: "/admissions", label: "Admissions", resource: "admissions" },
  { href: "/patients", label: "Patients", resource: "patients" },
  { href: "/follow-ups", label: "Follow-ups", resource: "follow_ups" },
  { href: "/referrals", label: "Referrals", resource: "referrals" },
  { href: "/camps", label: "Camps", resource: "camps" },
  { href: "/mobile-clinics", label: "Mobile", resource: "mobile_clinics" },
  { href: "/communication", label: "Messaging", resource: "communication" },
  { href: "/organizations", label: "Orgs", resource: "organizations" },
  { href: "/campaigns", label: "Campaigns", resource: "campaigns" },
  { href: "/retention", label: "Retention", resource: "retention" },
  { href: "/tasks", label: "Tasks", resource: "tasks" },
  { href: "/analytics", label: "Analytics", resource: "dashboards" },
  { href: "/reports", label: "Reports", resource: "reports" },
  { href: "/masters", label: "Masters", resource: "masters" },
  { href: "/audit", label: "Audit", resource: "audit" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Dashboard is visible to everyone logged in; other items respect RBAC.
  const items = NAV.filter((n) => n.resource === "dashboards" || can(user.role, n.resource, "view"));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">Sreedhareeyam PRM</span>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {items.map((n) => (
                <Link key={n.href} href={n.href} className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {user.name} · <span className="font-medium">{user.role.replace(/_/g, " ")}</span>
            </span>
            <form action={logout}>
              <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <DrillProvider>{children}</DrillProvider>
      </div>
    </div>
  );
}

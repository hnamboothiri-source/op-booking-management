import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { can, type Resource } from "@prm/core";

// Nav items with an implemented route, shown when the role can view the resource.
const NAV: { href: string; label: string; resource: Resource }[] = [
  { href: "/", label: "Dashboard", resource: "dashboards" },
  { href: "/leads", label: "Leads", resource: "leads" },
  { href: "/call-center", label: "Call Center", resource: "calls" },
  { href: "/prioritize", label: "Prioritize", resource: "calls" },
  { href: "/appointments", label: "Appointments", resource: "appointments" },
  { href: "/queue", label: "Queue", resource: "consultations" },
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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold text-emerald-700">Sreedhareeyam PRM</span>
            <nav className="flex gap-4 text-sm">
              {items.map((n) => (
                <Link key={n.href} href={n.href} className="text-slate-600 hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.name} · <span className="font-medium">{user.role.replace(/_/g, " ")}</span>
            </span>
            <form action={logout}>
              <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}

import { requireUser } from "@/lib/session";
import { can, type Resource } from "@prm/core";
import { AppShell, type NavItem } from "@/components/shell/AppShell";

// Sidebar nav: each item carries an icon + group for the grouped sidebar, and a
// resource for RBAC filtering. Data-driven so new modules are just new entries.
const NAV: (NavItem & { resource: Resource })[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", group: "Overview", resource: "dashboards" },
  { href: "/analytics", label: "Analytics", icon: "chart", group: "Overview", resource: "dashboards" },
  { href: "/reports", label: "Reports", icon: "report", group: "Overview", resource: "reports" },

  { href: "/leads", label: "Leads", icon: "leads", group: "Engagement", resource: "leads" },
  { href: "/call-center", label: "Call Center", icon: "headset", group: "Engagement", resource: "calls" },
  { href: "/calls", label: "Calls", icon: "phone", group: "Engagement", resource: "calls" },
  { href: "/prioritize", label: "Prioritize", icon: "target", group: "Engagement", resource: "calls" },
  { href: "/communication", label: "Messaging", icon: "message", group: "Engagement", resource: "communication" },

  { href: "/appointments", label: "Appointments", icon: "calendar", group: "Clinical", resource: "appointments" },
  { href: "/waitlist", label: "Waitlist", icon: "hourglass", group: "Clinical", resource: "appointments" },
  { href: "/queue", label: "Queue", icon: "queue", group: "Clinical", resource: "consultations" },
  { href: "/consultations", label: "Consultations", icon: "stethoscope", group: "Clinical", resource: "consultations" },
  { href: "/admissions", label: "Admissions", icon: "bed", group: "Clinical", resource: "admissions" },
  { href: "/patients", label: "Patients", icon: "patients", group: "Clinical", resource: "patients" },
  { href: "/follow-ups", label: "Follow-ups", icon: "bell", group: "Clinical", resource: "follow_ups" },

  { href: "/referrals", label: "Referrals", icon: "referral", group: "Outreach", resource: "referrals" },
  { href: "/camps", label: "Camps", icon: "tent", group: "Outreach", resource: "camps" },
  { href: "/mobile-clinics", label: "Mobile", icon: "truck", group: "Outreach", resource: "mobile_clinics" },
  { href: "/organizations", label: "Orgs", icon: "building", group: "Outreach", resource: "organizations" },

  { href: "/campaigns", label: "Campaigns", icon: "megaphone", group: "Growth", resource: "campaigns" },
  { href: "/retention", label: "Retention", icon: "heart", group: "Growth", resource: "retention" },
  { href: "/tasks", label: "Tasks", icon: "tasks", group: "Growth", resource: "tasks" },

  { href: "/masters", label: "Masters", icon: "sliders", group: "Admin", resource: "masters" },
  { href: "/audit", label: "Audit", icon: "shield", group: "Admin", resource: "audit" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Dashboard is visible to everyone logged in; other items respect RBAC.
  const items: NavItem[] = NAV.filter((n) => n.resource === "dashboards" || can(user.role, n.resource, "view"))
    .map(({ href, label, icon, group }) => ({ href, label, icon, group }));

  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <AppShell items={items} user={{ name: user.name, role: user.role }} todayLabel={todayLabel}>
      {children}
    </AppShell>
  );
}

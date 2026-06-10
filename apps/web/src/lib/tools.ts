/**
 * The Tools registry (sidebar utilities). Access is admin-granted per
 * designation (`Designation.tools`; empty = role default). `canUseTool` is the
 * shared gate for the view-level tool pages.
 */
import type { Resource } from "@prm/core";
import type { IconName } from "@/components/shell/NavIcon";
import { effectiveCan } from "./modules/access";
import type { CurrentUser } from "./session";

export interface ToolDef {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  resource: Resource;
}

export const UTILITIES: ToolDef[] = [
  { key: "master-plan", href: "/master-plan", label: "Master plan (vision)", icon: "target", resource: "dashboards" },
  { key: "group", href: "/group", label: "Group consolidation", icon: "chart", resource: "dashboards" },
  { key: "analytics", href: "/analytics", label: "Analytics", icon: "chart", resource: "dashboards" },
  { key: "reports", href: "/reports", label: "Reports", icon: "report", resource: "reports" },
  { key: "module-access", href: "/module-access", label: "Module access", icon: "shield", resource: "masters" },
  { key: "audit", href: "/audit", label: "Audit", icon: "shield", resource: "audit" },
];

/** Grantable in the designation editor. Admin pages keep their own edit gates. */
export const TOOL_OPTIONS = UTILITIES.map(({ key, label }) => ({ key, label }));

/**
 * May the user open this tool? Administrators always; an admin-granted
 * designation tool always; otherwise the role's own view grant decides.
 */
export function canUseTool(user: CurrentUser, key: string, resource: Resource): boolean {
  if (user.role === "administrator") return true;
  if (user.designationTools?.includes(key)) return true;
  return effectiveCan(user, resource, "view");
}

/**
 * Role-based access control (Module 16). Pure, dependency-free so it can be
 * unit-tested and reused by both the API layer and UI guards.
 *
 * Model: a permission is (resource, action). Each role maps to a set of grants.
 * `*` is a wildcard for resource or action. Branch scoping is orthogonal: some
 * roles only ever see their own branch's rows (enforced at the query layer).
 */

export type RoleName =
  | "administrator"
  | "management"
  | "call_center_executive"
  | "call_center_manager"
  | "front_office"
  | "doctor"
  | "optometry_staff"
  | "lab_staff"
  | "pharmacy_staff"
  | "admission_counsellor"
  | "patient_success_executive"
  | "marketing_team"
  | "branch_manager"
  | "company_manager"
  | "camp_coordinator"
  | "mobile_clinic_coordinator"
  | "module_manager";

export type Action = "view" | "create" | "edit" | "delete";

/** Resource keys map to modules / areas of the app. */
export type Resource =
  | "masters"
  | "leads"
  | "calls"
  | "appointments"
  | "patients"
  | "consultations"
  | "referrals"
  | "camps"
  | "mobile_clinics"
  | "follow_ups"
  | "admissions"
  | "communication"
  | "retention"
  | "campaigns"
  | "organizations"
  | "tasks"
  | "dashboards"
  | "reports"
  | "audit"
  | "users";

type Grant = { resource: Resource | "*"; actions: Action[] | "*" };

const ALL: Action[] = ["view", "create", "edit", "delete"];
const RW: Action[] = ["view", "create", "edit"];
const RO: Action[] = ["view"];

export const ROLE_GRANTS: Record<RoleName, Grant[]> = {
  administrator: [{ resource: "*", actions: "*" }],

  management: [
    { resource: "dashboards", actions: RO },
    { resource: "reports", actions: RO },
    { resource: "audit", actions: RO },
    { resource: "leads", actions: RO },
    { resource: "appointments", actions: RO },
    { resource: "consultations", actions: RO },
    { resource: "admissions", actions: RO },
    { resource: "campaigns", actions: RO },
    { resource: "retention", actions: RO },
    { resource: "referrals", actions: RO },
  ],

  call_center_executive: [
    { resource: "leads", actions: RW },
    { resource: "calls", actions: RW },
    { resource: "appointments", actions: RW },
    { resource: "follow_ups", actions: RW },
    { resource: "tasks", actions: RW },
    { resource: "patients", actions: RO },
    { resource: "communication", actions: ["view", "create"] },
  ],

  call_center_manager: [
    { resource: "leads", actions: ALL },
    { resource: "calls", actions: ALL },
    { resource: "appointments", actions: RW },
    { resource: "follow_ups", actions: ALL },
    { resource: "tasks", actions: ALL },
    { resource: "patients", actions: RO },
    { resource: "communication", actions: RW },
    { resource: "dashboards", actions: RO },
    { resource: "reports", actions: RO },
  ],

  front_office: [
    { resource: "appointments", actions: RW },
    { resource: "patients", actions: RW },
    { resource: "leads", actions: ["view", "create"] },
    { resource: "tasks", actions: RW },
  ],

  doctor: [
    { resource: "consultations", actions: RW },
    { resource: "patients", actions: RO },
    { resource: "appointments", actions: RO },
    { resource: "referrals", actions: ["view", "create"] },
    { resource: "admissions", actions: ["view", "create"] },
    { resource: "follow_ups", actions: ["view", "create"] },
  ],

  optometry_staff: [{ resource: "referrals", actions: RW }, { resource: "patients", actions: RO }],
  lab_staff: [{ resource: "referrals", actions: RW }, { resource: "patients", actions: RO }],
  pharmacy_staff: [{ resource: "patients", actions: RO }, { resource: "consultations", actions: RO }],

  admission_counsellor: [
    { resource: "admissions", actions: ALL },
    { resource: "tasks", actions: RW },
    { resource: "patients", actions: RO },
    { resource: "follow_ups", actions: RW },
  ],

  patient_success_executive: [
    { resource: "retention", actions: RW },
    { resource: "follow_ups", actions: ALL },
    { resource: "tasks", actions: RW },
    { resource: "patients", actions: RO },
    { resource: "communication", actions: RW },
  ],

  marketing_team: [
    { resource: "campaigns", actions: ALL },
    { resource: "leads", actions: RO },
    { resource: "communication", actions: RW },
    { resource: "referrals", actions: RW },
    { resource: "organizations", actions: RW },
    { resource: "reports", actions: RO },
    { resource: "dashboards", actions: RO },
  ],

  branch_manager: [
    { resource: "dashboards", actions: RO },
    { resource: "reports", actions: RO },
    { resource: "leads", actions: RO },
    { resource: "appointments", actions: RO },
    { resource: "consultations", actions: RO },
    { resource: "follow_ups", actions: RO },
    { resource: "tasks", actions: RO },
  ],

  // Company-level oversight: like `management` but pinned to one company's
  // centres (org scoping is orthogonal — see orgScopeWhere).
  company_manager: [
    { resource: "dashboards", actions: RO },
    { resource: "reports", actions: RO },
    { resource: "leads", actions: RO },
    { resource: "appointments", actions: RO },
    { resource: "consultations", actions: RO },
    { resource: "admissions", actions: RO },
    { resource: "campaigns", actions: RO },
    { resource: "retention", actions: RO },
    { resource: "referrals", actions: RO },
    { resource: "follow_ups", actions: RO },
    { resource: "tasks", actions: RO },
  ],

  camp_coordinator: [
    { resource: "camps", actions: ALL },
    { resource: "leads", actions: ["view", "create"] },
    { resource: "tasks", actions: RW },
  ],

  mobile_clinic_coordinator: [
    { resource: "mobile_clinics", actions: ALL },
    { resource: "leads", actions: ["view", "create"] },
    { resource: "tasks", actions: RW },
  ],

  // A department manager. The static grant is just a read-only floor; their real
  // (CRUD) authority is granted dynamically over the modules they own — see
  // `effectiveCan` below and the web-side module-ownership map.
  module_manager: [
    { resource: "dashboards", actions: RO },
    { resource: "reports", actions: RO },
  ],
};

/** Does this role have permission to perform `action` on `resource`? */
export function can(role: RoleName, resource: Resource, action: Action): boolean {
  const grants = ROLE_GRANTS[role] ?? [];
  return grants.some(
    (g) =>
      (g.resource === "*" || g.resource === resource) &&
      (g.actions === "*" || g.actions.includes(action)),
  );
}

/** Resources the role can at least view — used to build the nav menu. */
export function visibleResources(role: RoleName): Resource[] {
  const all: Resource[] = [
    "dashboards", "leads", "calls", "appointments", "patients", "consultations",
    "referrals", "camps", "mobile_clinics", "follow_ups", "admissions",
    "communication", "retention", "campaigns", "organizations", "tasks",
    "reports", "masters", "audit", "users",
  ];
  return all.filter((r) => can(role, r, "view"));
}

/** Roles that may only see their own branch's data (branch scoping, Module 16). */
const BRANCH_SCOPED: ReadonlySet<RoleName> = new Set<RoleName>([
  "front_office",
  "branch_manager",
  "camp_coordinator",
  "mobile_clinic_coordinator",
]);

export function isBranchScoped(role: RoleName): boolean {
  return BRANCH_SCOPED.has(role);
}

/**
 * Build a Prisma-style `where` fragment for branch scoping. Admin/management see
 * all branches; scoped roles are pinned to their own branch.
 */
export function branchScopeWhere(role: RoleName, branchId: string | null): { branchId?: string } {
  if (isBranchScoped(role) && branchId) return { branchId };
  return {};
}

/** Roles scoped to one company's centres (the caller resolves the centre list). */
export function isCompanyScoped(role: RoleName): boolean {
  return role === "company_manager";
}

export type OrgScopeWhere = { branchId?: string | { in: string[] } };

/**
 * Org-aware scope `where` fragment. Three tiers:
 *  - group roles (administrator, management, …) → no constraint;
 *  - company-scoped roles → pinned to the company's centres (`branchId IN`);
 *  - branch-scoped roles → pinned to their own centre.
 * `companyBranchIds` is resolved by the caller (kept pure / DB-free here). An
 * `activeBranchId` narrows a company/group user to one centre when they pick
 * one in the centre switcher.
 */
export function orgScopeWhere(
  role: RoleName,
  branchId: string | null,
  companyBranchIds: string[] | null,
  activeBranchId?: string | null,
): OrgScopeWhere {
  if (isBranchScoped(role)) return branchId ? { branchId } : {};
  if (isCompanyScoped(role)) {
    if (activeBranchId && (companyBranchIds ?? []).includes(activeBranchId)) return { branchId: activeBranchId };
    return companyBranchIds && companyBranchIds.length ? { branchId: { in: companyBranchIds } } : {};
  }
  // Group-level roles: unconstrained unless they picked a centre.
  if (activeBranchId) return { branchId: activeBranchId };
  return {};
}

/**
 * Module allotment per centre: is `slug` one of the modules this centre runs?
 * An empty / missing list means ALL modules are enabled (backward compatible —
 * un-configured centres lose nothing).
 */
export function branchModuleEnabled(enabledModules: string[] | null | undefined, slug: string): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(slug);
}

/**
 * Module ownership is an orthogonal scope (like branch scoping): a department
 * manager gets full CRUD on the resources of the modules they own, on top of
 * whatever their role already grants. Pure so it stays unit-testable — the
 * caller resolves `managedResources` from the module registry.
 */
export function effectiveCan(
  roleAllows: boolean,
  managedResources: readonly Resource[],
  resource: Resource,
): boolean {
  return roleAllows || managedResources.includes(resource);
}

import { describe, it, expect } from "vitest";
import { can, visibleResources, isBranchScoped, isCompanyScoped, branchScopeWhere, orgScopeWhere, effectiveCan, branchModuleEnabled } from "./rbac";

describe("rbac.can", () => {
  it("administrator can do anything", () => {
    expect(can("administrator", "masters", "delete")).toBe(true);
    expect(can("administrator", "audit", "view")).toBe(true);
  });

  it("only administrator manages masters", () => {
    expect(can("administrator", "masters", "edit")).toBe(true);
    expect(can("call_center_executive", "masters", "edit")).toBe(false);
    expect(can("management", "masters", "view")).toBe(false);
  });

  it("call centre handles leads but not clinical edits", () => {
    expect(can("call_center_executive", "leads", "create")).toBe(true);
    expect(can("call_center_executive", "consultations", "edit")).toBe(false);
  });

  it("doctor edits consultations, only views patients", () => {
    expect(can("doctor", "consultations", "edit")).toBe(true);
    expect(can("doctor", "patients", "edit")).toBe(false);
  });

  it("management is read-only on dashboards/reports", () => {
    expect(can("management", "dashboards", "view")).toBe(true);
    expect(can("management", "leads", "edit")).toBe(false);
  });
});

describe("rbac.visibleResources", () => {
  it("admin sees everything including masters and audit", () => {
    const v = visibleResources("administrator");
    expect(v).toContain("masters");
    expect(v).toContain("audit");
    expect(v).toContain("users");
  });
  it("call exec does not see masters", () => {
    expect(visibleResources("call_center_executive")).not.toContain("masters");
  });
});

describe("rbac branch scoping", () => {
  it("flags branch-scoped roles", () => {
    expect(isBranchScoped("branch_manager")).toBe(true);
    expect(isBranchScoped("front_office")).toBe(true);
    expect(isBranchScoped("administrator")).toBe(false);
  });
  it("pins scoped roles to their branch in where clause", () => {
    expect(branchScopeWhere("branch_manager", "b1")).toEqual({ branchId: "b1" });
    expect(branchScopeWhere("administrator", "b1")).toEqual({});
    expect(branchScopeWhere("branch_manager", null)).toEqual({});
  });
});

describe("rbac org scoping (orgScopeWhere)", () => {
  const centres = ["b1", "b2", "b3"];
  it("group roles see everything", () => {
    expect(orgScopeWhere("administrator", "b1", null)).toEqual({});
    expect(orgScopeWhere("management", null, null)).toEqual({});
  });
  it("group roles narrow to a picked centre", () => {
    expect(orgScopeWhere("administrator", "b1", null, "b2")).toEqual({ branchId: "b2" });
  });
  it("company_manager is pinned to the company's centres", () => {
    expect(isCompanyScoped("company_manager")).toBe(true);
    expect(orgScopeWhere("company_manager", null, centres)).toEqual({ branchId: { in: centres } });
  });
  it("company_manager narrows to a picked centre only within the company", () => {
    expect(orgScopeWhere("company_manager", null, centres, "b2")).toEqual({ branchId: "b2" });
    expect(orgScopeWhere("company_manager", null, centres, "other")).toEqual({ branchId: { in: centres } });
  });
  it("branch-scoped roles stay pinned to their own centre regardless of switcher", () => {
    expect(orgScopeWhere("branch_manager", "b1", centres, "b2")).toEqual({ branchId: "b1" });
    expect(orgScopeWhere("front_office", null, null, "b2")).toEqual({});
  });
  it("company_manager without a resolved centre list is unconstrained (fail-open for group fallback)", () => {
    expect(orgScopeWhere("company_manager", null, null)).toEqual({});
  });
});

describe("rbac module allotment (branchModuleEnabled)", () => {
  it("empty or missing list means all modules enabled", () => {
    expect(branchModuleEnabled([], "camps")).toBe(true);
    expect(branchModuleEnabled(null, "camps")).toBe(true);
    expect(branchModuleEnabled(undefined, "camps")).toBe(true);
  });
  it("a non-empty list restricts to its slugs", () => {
    const op = ["leads", "appointments", "consultations"];
    expect(branchModuleEnabled(op, "appointments")).toBe(true);
    expect(branchModuleEnabled(op, "camps")).toBe(false);
  });
});

describe("rbac module ownership (effectiveCan)", () => {
  it("module_manager floor is read-only dashboards/reports", () => {
    expect(can("module_manager", "reports", "view")).toBe(true);
    expect(can("module_manager", "consultations", "edit")).toBe(false);
  });
  it("grants CRUD on owned-module resources on top of role", () => {
    const owned = ["consultations", "follow_ups"] as const;
    // role denies it, but ownership grants it
    expect(effectiveCan(can("module_manager", "consultations", "edit"), owned, "consultations")).toBe(true);
    expect(effectiveCan(can("module_manager", "follow_ups", "delete"), owned, "follow_ups")).toBe(true);
  });
  it("does not grant resources outside owned modules", () => {
    const owned = ["consultations"] as const;
    expect(effectiveCan(can("module_manager", "campaigns", "edit"), owned, "campaigns")).toBe(false);
  });
  it("passes through whatever the role already allows", () => {
    expect(effectiveCan(can("administrator", "campaigns", "delete"), [], "campaigns")).toBe(true);
  });
});

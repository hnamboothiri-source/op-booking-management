import { describe, it, expect } from "vitest";
import { can, visibleResources, isBranchScoped, branchScopeWhere } from "./rbac";

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

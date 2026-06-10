import { describe, it, expect } from "vitest";
import { planProgressPct, activitiesBudget, activityRollup, approvalRollup, canVerify, canApprove, nextStep, separationOk, scopeCovers } from "./planning";

describe("planning helpers", () => {
  it("computes progress %", () => {
    expect(planProgressPct(50, 200)).toBe(25);
    expect(planProgressPct(250, 200)).toBe(125);
    expect(planProgressPct(5, 0)).toBe(0);
  });
  it("sums activity budgets", () => {
    expect(activitiesBudget([{ title: "a", status: "planned", budget: 1000 }, { title: "b", status: "done", budget: 500 }])).toBe(1500);
    expect(activitiesBudget()).toBe(0);
  });
  it("rolls up activity statuses", () => {
    const r = activityRollup([
      { title: "a", status: "done" },
      { title: "b", status: "in_progress" },
      { title: "c", status: "planned" },
      { title: "d", status: "done" },
    ]);
    expect(r).toEqual({ total: 4, done: 2, inProgress: 1, planned: 1 });
  });
});

describe("planning approval rollup", () => {
  it("counts by approval step, defaulting missing approval to entered", () => {
    const r = approvalRollup([
      { title: "a", status: "planned" }, // no approval object
      { title: "b", status: "planned", approval: { status: "entered" } },
      { title: "c", status: "in_progress", approval: { status: "verified" } },
      { title: "d", status: "done", approval: { status: "approved" } },
      { title: "e", status: "planned", approval: { status: "rejected" } },
      { title: "f", status: "done", approval: { status: "approved" } },
    ]);
    expect(r).toEqual({ entered: 2, verified: 1, approved: 2, rejected: 1 });
  });
  it("handles empty input", () => {
    expect(approvalRollup()).toEqual({ entered: 0, verified: 0, approved: 0, rejected: 0 });
    expect(approvalRollup([])).toEqual({ entered: 0, verified: 0, approved: 0, rejected: 0 });
  });
});

describe("planning org scope (scopeCovers)", () => {
  const chennaiMgr = { role: "branch_manager" as const, branchId: "br-che", companyId: "co-saec" };
  const saecMgr = { role: "company_manager" as const, branchId: null, companyId: "co-saec" };
  const groupAdmin = { role: "administrator" as const, branchId: "br-main", companyId: "co-saeh" };
  const chennaiPlan = { branchId: "br-che", companyId: "co-saec" };
  const ekmPlan = { branchId: "br-koc", companyId: "co-saec" };
  const saecPlan = { branchId: null, companyId: "co-saec" };
  const groupPlan = { branchId: null, companyId: null };

  it("centre staff cover only their own centre's plans", () => {
    expect(scopeCovers(chennaiMgr, chennaiPlan)).toBe(true);
    expect(scopeCovers(chennaiMgr, ekmPlan)).toBe(false);
    expect(scopeCovers(chennaiMgr, saecPlan)).toBe(false);
  });
  it("company managers cover their company's plans and its centres' plans", () => {
    expect(scopeCovers(saecMgr, chennaiPlan)).toBe(true);
    expect(scopeCovers(saecMgr, ekmPlan)).toBe(true);
    expect(scopeCovers(saecMgr, saecPlan)).toBe(true);
    expect(scopeCovers(saecMgr, { branchId: "br-main", companyId: "co-saeh" })).toBe(false);
  });
  it("group roles cover everything", () => {
    expect(scopeCovers(groupAdmin, chennaiPlan)).toBe(true);
    expect(scopeCovers(groupAdmin, saecPlan)).toBe(true);
    expect(scopeCovers(groupAdmin, groupPlan)).toBe(true);
  });
  it("legacy group plans stay open to all ranks", () => {
    expect(scopeCovers(chennaiMgr, groupPlan)).toBe(true);
    expect(scopeCovers(saecMgr, groupPlan)).toBe(true);
  });
});

describe("planning approval (maker-checker-approver)", () => {
  it("rank capabilities", () => {
    expect(canVerify("staff")).toBe(false);
    expect(canVerify("supervisor")).toBe(true);
    expect(canVerify("manager")).toBe(true);
    expect(canApprove("supervisor")).toBe(false);
    expect(canApprove("manager")).toBe(true);
  });
  it("next step in the flow", () => {
    expect(nextStep("entered")).toBe("verify");
    expect(nextStep("verified")).toBe("approve");
    expect(nextStep("approved")).toBeNull();
  });
  it("separation of duties (admin overrides)", () => {
    const a = { status: "verified" as const, enteredById: "u1", verifiedById: "u2" };
    expect(separationOk("verify", "u1", a, false)).toBe(false); // enterer can't verify
    expect(separationOk("approve", "u2", a, false)).toBe(false); // verifier can't approve
    expect(separationOk("approve", "u3", a, false)).toBe(true);
    expect(separationOk("approve", "u1", a, true)).toBe(true); // admin override
  });
});

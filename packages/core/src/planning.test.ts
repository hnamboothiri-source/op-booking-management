import { describe, it, expect } from "vitest";
import { planProgressPct, activitiesBudget, activityRollup, canVerify, canApprove, nextStep, separationOk } from "./planning";

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

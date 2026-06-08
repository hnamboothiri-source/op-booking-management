import { describe, it, expect } from "vitest";
import { routeLeadOwner, type AssignmentRule } from "./assignment";

const RULES: AssignmentRule[] = [
  { match: { diseaseId: "d-cataract" }, ownerId: "u-cataract", label: "cataract specialist" },
  { match: { branchId: "b-kochi" }, ownerId: "u-kochi", label: "kochi team" },
  { match: { sourceGroup: "referral" }, ownerId: "u-referral", label: "referral desk" },
];

describe("routeLeadOwner", () => {
  it("matches a disease-specific rule first", () => {
    const r = routeLeadOwner({ diseaseId: "d-cataract", branchId: "b-kochi" }, RULES);
    expect(r.ownerId).toBe("u-cataract");
    expect(r.reason).toBe("cataract specialist");
  });
  it("falls through to a branch rule when disease does not match", () => {
    expect(routeLeadOwner({ branchId: "b-kochi" }, RULES).ownerId).toBe("u-kochi");
  });
  it("matches by source group", () => {
    expect(routeLeadOwner({ sourceGroup: "referral" }, RULES).ownerId).toBe("u-referral");
  });
  it("uses the fallback owner when no rule matches", () => {
    const r = routeLeadOwner({ branchId: "b-other" }, RULES, "u-pool");
    expect(r.ownerId).toBe("u-pool");
    expect(r.reason).toContain("fallback");
  });
  it("leaves unassigned when no rule and no fallback", () => {
    expect(routeLeadOwner({}, RULES).ownerId).toBeNull();
  });
  it("requires every defined match key to equal the signal", () => {
    const rules: AssignmentRule[] = [{ match: { branchId: "b1", diseaseId: "d1" }, ownerId: "u1" }];
    expect(routeLeadOwner({ branchId: "b1", diseaseId: "dX" }, rules).ownerId).toBeNull();
    expect(routeLeadOwner({ branchId: "b1", diseaseId: "d1" }, rules).ownerId).toBe("u1");
  });
});

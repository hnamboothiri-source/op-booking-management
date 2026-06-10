import { describe, it, expect } from "vitest";
import {
  wouldCreateCycle, reportingChain, directReportsOf, approverOf, designationTree,
  validReportsTo, effectiveIdentity, pageAllowed, activityTypeAllowed, rankForModule, type DesignationNode,
} from "./designation";

const d = (over: Partial<DesignationNode> & { id: string }): DesignationNode => ({
  name: over.id, companyId: "co-1", level: 1, roleTemplate: "patient_success_executive",
  planRank: "staff", moduleSlugs: [], pageAccess: null,
  reportsToDesignationId: null, approverDesignationId: null, active: true,
  ...over,
});

// Group head ← CEO ← Dept head ← Manager ← Executive
const HIERARCHY: DesignationNode[] = [
  d({ id: "head", companyId: null, level: 1, planRank: "manager", roleTemplate: "management" }),
  d({ id: "ceo", level: 2, planRank: "manager", roleTemplate: "company_manager", reportsToDesignationId: "head" }),
  d({ id: "dept", level: 3, planRank: "manager", reportsToDesignationId: "ceo" }),
  d({ id: "mgr", level: 5, planRank: "supervisor", reportsToDesignationId: "dept" }),
  d({ id: "exec", level: 7, reportsToDesignationId: "mgr", approverDesignationId: "dept" }),
];

describe("designation cycles", () => {
  it("rejects self-reporting", () => {
    expect(wouldCreateCycle(HIERARCHY, "mgr", "mgr")).toBe(true);
  });
  it("rejects direct and deep cycles", () => {
    expect(wouldCreateCycle(HIERARCHY, "dept", "mgr")).toBe(true); // mgr reports to dept already
    expect(wouldCreateCycle(HIERARCHY, "ceo", "exec")).toBe(true); // exec → mgr → dept → ceo
  });
  it("allows valid re-pointing and clearing", () => {
    expect(wouldCreateCycle(HIERARCHY, "exec", "dept")).toBe(false);
    expect(wouldCreateCycle(HIERARCHY, "exec", null)).toBe(false);
  });
  it("survives a pre-existing corrupt cycle elsewhere", () => {
    const corrupt = [d({ id: "a", reportsToDesignationId: "b" }), d({ id: "b", reportsToDesignationId: "a" }), d({ id: "c" })];
    expect(wouldCreateCycle(corrupt, "c", "a")).toBe(false);
  });
});

describe("designation chain & reports", () => {
  it("walks the chain upward, nearest first", () => {
    expect(reportingChain(HIERARCHY, "exec").map((x) => x.id)).toEqual(["mgr", "dept", "ceo", "head"]);
  });
  it("stops at a missing parent", () => {
    const broken = [d({ id: "x", reportsToDesignationId: "ghost" })];
    expect(reportingChain(broken, "x")).toEqual([]);
  });
  it("computes direct reports (active only)", () => {
    const withInactive = [...HIERARCHY, d({ id: "old", reportsToDesignationId: "dept", active: false })];
    expect(directReportsOf(withInactive, "dept").map((x) => x.id)).toEqual(["mgr"]);
  });
});

describe("designation approver", () => {
  it("explicit approver wins", () => {
    expect(approverOf(HIERARCHY, "exec")?.id).toBe("dept");
  });
  it("falls back to the reporting officer", () => {
    expect(approverOf(HIERARCHY, "mgr")?.id).toBe("dept");
  });
  it("skips an inactive approver", () => {
    const all = [d({ id: "boss", active: false }), d({ id: "sub", reportsToDesignationId: "boss" })];
    expect(approverOf(all, "sub")).toBeNull();
  });
});

describe("designation tree", () => {
  it("builds roots and nested children; orphans become roots", () => {
    const all = [...HIERARCHY, d({ id: "orphan", level: 4, reportsToDesignationId: "ghost" })];
    const tree = designationTree(all);
    expect(tree.map((t) => t.node.id)).toEqual(["head", "orphan"]);
    expect(tree[0].children[0].node.id).toBe("ceo");
    expect(tree[0].children[0].children[0].node.id).toBe("dept");
  });
});

describe("validReportsTo (per-company catalogues)", () => {
  it("allows same company and group-level parents", () => {
    expect(validReportsTo({ companyId: "co-1" }, { companyId: "co-1" })).toBe(true);
    expect(validReportsTo({ companyId: "co-1" }, { companyId: null })).toBe(true);
  });
  it("rejects cross-company parents", () => {
    expect(validReportsTo({ companyId: "co-1" }, { companyId: "co-2" })).toBe(false);
  });
});

describe("effectiveIdentity", () => {
  const exec = d({
    id: "exec", roleTemplate: "patient_success_executive", planRank: "staff",
    moduleSlugs: ["retention", "follow-ups"], pageAccess: { retention: ["/retention/worklist"] },
    activityTypes: { "follow-ups": ["followup_drive"] },
  });
  it("designation supplies role, rank and access lists", () => {
    expect(effectiveIdentity("front_office", "supervisor", exec)).toEqual({
      role: "patient_success_executive", planRank: "staff",
      moduleSlugs: ["retention", "follow-ups"], pageAccess: { retention: ["/retention/worklist"] },
      activityTypes: { "follow-ups": ["followup_drive"] },
      moduleRanks: null,
      tools: null,
    });
  });
  it("passes admin-granted tools through", () => {
    const ceo = d({ id: "ceo2", roleTemplate: "company_manager", planRank: "manager", tools: ["master-plan", "group"] });
    expect(effectiveIdentity("front_office", "staff", ceo).tools).toEqual(["master-plan", "group"]);
  });
  it("passes per-module rank overrides through", () => {
    const mgr = d({ id: "mgr2", planRank: "supervisor", moduleRanks: { communication: "read_only" } });
    expect(effectiveIdentity("front_office", "staff", mgr).moduleRanks).toEqual({ communication: "read_only" });
  });
  it("empty lists mean no restriction", () => {
    const open = d({ id: "open", roleTemplate: "management", planRank: "manager" });
    expect(effectiveIdentity("front_office", "staff", open)).toEqual({
      role: "management", planRank: "manager", moduleSlugs: null, pageAccess: null, activityTypes: null, moduleRanks: null, tools: null,
    });
  });
  it("administrators are never demoted", () => {
    expect(effectiveIdentity("administrator", "manager", exec)).toEqual({
      role: "administrator", planRank: "manager", moduleSlugs: null, pageAccess: null, activityTypes: null, moduleRanks: null, tools: null,
    });
  });
  it("inactive or missing designation passes through", () => {
    expect(effectiveIdentity("doctor", "staff", d({ id: "x", active: false }))).toEqual({
      role: "doctor", planRank: "staff", moduleSlugs: null, pageAccess: null, activityTypes: null, moduleRanks: null, tools: null,
    });
    expect(effectiveIdentity("doctor", "staff", null)).toEqual({
      role: "doctor", planRank: "staff", moduleSlugs: null, pageAccess: null, activityTypes: null, moduleRanks: null, tools: null,
    });
  });
});

describe("activityTypeAllowed", () => {
  const access = { "follow-ups": ["followup_drive"], retention: ["reactivation_drive"] };
  it("no restriction or no module key = allowed", () => {
    expect(activityTypeAllowed(null, "follow-ups", "anything")).toBe(true);
    expect(activityTypeAllowed(access, "leads", "generate_leads")).toBe(true);
    expect(activityTypeAllowed({ leads: [] }, "leads", "call_drive")).toBe(true);
  });
  it("listed keys are allowed, others blocked (exact match)", () => {
    expect(activityTypeAllowed(access, "follow-ups", "followup_drive")).toBe(true);
    expect(activityTypeAllowed(access, "retention", "reactivation_drive")).toBe(true);
    expect(activityTypeAllowed(access, "retention", "message_blast")).toBe(false);
    expect(activityTypeAllowed(access, "follow-ups", "followup")).toBe(false);
  });
});

describe("rankForModule (per-module approval override)", () => {
  const ranks = { communication: "read_only" as const, "follow-ups": "manager" as const };
  it("override wins for its module", () => {
    expect(rankForModule("supervisor", ranks, "communication")).toBe("read_only");
    expect(rankForModule("supervisor", ranks, "follow-ups")).toBe("manager");
  });
  it("falls back to the base rank", () => {
    expect(rankForModule("supervisor", ranks, "retention")).toBe("supervisor");
    expect(rankForModule("staff", null, "leads")).toBe("staff");
    expect(rankForModule("manager", undefined, "leads")).toBe("manager");
  });
});

describe("pageAllowed", () => {
  const access = { retention: ["/retention/worklist", "/modules/retention/reports"] };
  it("no restriction object or no module key = allowed", () => {
    expect(pageAllowed(null, "retention", "/retention/campaigns")).toBe(true);
    expect(pageAllowed(access, "leads", "/leads/new")).toBe(true);
    expect(pageAllowed({ retention: [] }, "retention", "/retention/campaigns")).toBe(true);
  });
  it("listed pages and their subpaths are allowed", () => {
    expect(pageAllowed(access, "retention", "/retention/worklist")).toBe(true);
    expect(pageAllowed(access, "retention", "/retention/worklist/x")).toBe(true);
    expect(pageAllowed(access, "retention", "/modules/retention/reports")).toBe(true);
  });
  it("unlisted pages are blocked", () => {
    expect(pageAllowed(access, "retention", "/retention/campaigns")).toBe(false);
    expect(pageAllowed(access, "retention", "/modules/retention/plan")).toBe(false);
  });
});

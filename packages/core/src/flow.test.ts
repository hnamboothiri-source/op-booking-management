import { describe, it, expect } from "vitest";
import { FLOW_PHASES, FLOW_PHASE_LABELS, flowPhaseOrder, flowPhaseBlocked } from "./flow";

describe("flow phases", () => {
  it("orders planning → implementation → result", () => {
    expect([...FLOW_PHASES]).toEqual(["planning", "implementation", "result"]);
    expect(flowPhaseOrder("planning")).toBe(0);
    expect(flowPhaseOrder("implementation")).toBe(1);
    expect(flowPhaseOrder("result")).toBe(2);
    expect(flowPhaseOrder(undefined)).toBe(3);
    expect(flowPhaseOrder(null)).toBe(3);
  });

  it("labels every phase", () => {
    for (const p of FLOW_PHASES) expect(FLOW_PHASE_LABELS[p]).toBeTruthy();
  });
});

describe("flowPhaseBlocked", () => {
  it("blocks implementation only when a plan is required and not ready", () => {
    expect(flowPhaseBlocked("implementation", true, false)).toBe(true);
    expect(flowPhaseBlocked("implementation", true, true)).toBe(false);
    expect(flowPhaseBlocked("implementation", false, false)).toBe(false);
  });

  it("never blocks planning or result", () => {
    expect(flowPhaseBlocked("planning", true, false)).toBe(false);
    expect(flowPhaseBlocked("result", true, false)).toBe(false);
    expect(flowPhaseBlocked(undefined, true, false)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  LEAD_STAGES, isClosedStage, isConverted, isOpenLead, conversionRate,
  nextLeadNumber, LEAD_ACTIVITY_KINDS,
} from "./leads";

describe("lead stage helpers", () => {
  it("flags closed stages", () => {
    expect(isClosedStage("lost")).toBe(true);
    expect(isClosedStage("not_interested")).toBe(true);
    expect(isClosedStage("new_lead")).toBe(false);
  });
  it("flags converted/open", () => {
    expect(isConverted("converted_to_patient")).toBe(true);
    expect(isConverted("appointment_booked")).toBe(true);
    expect(isOpenLead("contacted")).toBe(true);
    expect(isOpenLead("lost")).toBe(false);
    expect(isOpenLead("converted_to_patient")).toBe(false);
  });
  it("has 9 stages", () => expect(LEAD_STAGES).toHaveLength(9));
});

describe("conversionRate", () => {
  it("rounds to one decimal and guards zero", () => {
    expect(conversionRate(40, 100)).toBe(40);
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(5, 0)).toBe(0);
  });
});

describe("nextLeadNumber", () => {
  it("zero-pads the sequence to 6 digits with year", () => {
    expect(nextLeadNumber(1, 2026)).toBe("LEAD-2026-000001");
    expect(nextLeadNumber(123, 2026)).toBe("LEAD-2026-000123");
    expect(nextLeadNumber(1234567, 2025)).toBe("LEAD-2025-1234567");
  });
  it("floors and clamps to at least 1", () => {
    expect(nextLeadNumber(0, 2026)).toBe("LEAD-2026-000001");
    expect(nextLeadNumber(12.9, 2026)).toBe("LEAD-2026-000012");
  });
});

describe("LEAD_ACTIVITY_KINDS", () => {
  it("includes the core timeline kinds", () => {
    expect(LEAD_ACTIVITY_KINDS).toContain("created");
    expect(LEAD_ACTIVITY_KINDS).toContain("call");
    expect(LEAD_ACTIVITY_KINDS).toContain("stage_change");
    expect(LEAD_ACTIVITY_KINDS).toContain("transfer");
  });
});

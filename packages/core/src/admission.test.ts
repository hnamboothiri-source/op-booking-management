import { describe, it, expect } from "vitest";
import {
  canTransitionAdmission, nextAdmissionStatuses, isAdmissionTerminal,
  admissionNeedsReason, admissionConversionRate, outcomeImpliesAdmission, outcomeImpliesFollowUp,
} from "./admission";

describe("admission transitions", () => {
  it("walks recommended → admitted", () => {
    expect(canTransitionAdmission("recommended", "counselled")).toBe(true);
    expect(canTransitionAdmission("counselled", "accepted")).toBe(true);
    expect(canTransitionAdmission("accepted", "admitted")).toBe(true);
  });
  it("blocks illegal and post-terminal moves", () => {
    expect(canTransitionAdmission("recommended", "admitted")).toBe(false);
    expect(canTransitionAdmission("admitted", "counselled")).toBe(false);
    expect(isAdmissionTerminal("rejected")).toBe(true);
    expect(nextAdmissionStatuses("admitted")).toEqual([]);
  });
  it("requires a reason for rejection / lost", () => {
    expect(admissionNeedsReason("rejected")).toBe(true);
    expect(admissionNeedsReason("lost")).toBe(true);
    expect(admissionNeedsReason("counselled")).toBe(false);
  });
  it("computes conversion rate", () => {
    expect(admissionConversionRate(2, 5)).toBe(40);
    expect(admissionConversionRate(0, 0)).toBe(0);
  });
});

describe("consultation outcome implications", () => {
  it("flags admission-implying outcomes", () => {
    expect(outcomeImpliesAdmission("admission_advised")).toBe(true);
    expect(outcomeImpliesAdmission("surgery_or_procedure_advised")).toBe(true);
    expect(outcomeImpliesAdmission("medicine_prescribed")).toBe(false);
  });
  it("flags follow-up-implying outcomes", () => {
    expect(outcomeImpliesFollowUp("follow_up_advised")).toBe(true);
    expect(outcomeImpliesFollowUp("no_treatment_required")).toBe(false);
  });
});

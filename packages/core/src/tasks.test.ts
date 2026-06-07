import { describe, it, expect } from "vitest";
import { canTransition, isOverdue, effectiveStatus, isTerminal } from "./tasks";

describe("task transitions", () => {
  it("allows open -> in_progress -> completed", () => {
    expect(canTransition("open", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(true);
  });
  it("forbids transitions out of terminal states", () => {
    expect(canTransition("completed", "open")).toBe(false);
    expect(canTransition("cancelled", "in_progress")).toBe(false);
    expect(isTerminal("completed")).toBe(true);
  });
  it("allows escalation and recovery", () => {
    expect(canTransition("open", "escalated")).toBe(true);
    expect(canTransition("escalated", "in_progress")).toBe(true);
  });
});

describe("overdue derivation", () => {
  const now = new Date(2026, 5, 7); // 2026-06-07

  it("is overdue when past due and not terminal", () => {
    expect(isOverdue(new Date(2026, 5, 1), "open", now)).toBe(true);
    expect(isOverdue(new Date(2026, 5, 1), "in_progress", now)).toBe(true);
  });
  it("is not overdue when terminal, escalated, or no due date", () => {
    expect(isOverdue(new Date(2026, 5, 1), "completed", now)).toBe(false);
    expect(isOverdue(new Date(2026, 5, 1), "escalated", now)).toBe(false);
    expect(isOverdue(null, "open", now)).toBe(false);
  });
  it("derives effective status", () => {
    expect(effectiveStatus("open", new Date(2026, 5, 1), now)).toBe("overdue");
    expect(effectiveStatus("open", new Date(2026, 5, 20), now)).toBe("open");
  });
});

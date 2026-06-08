import { describe, it, expect } from "vitest";
import { requiredMissing, TASK_OUTCOMES, REACTIVATION_RESULTS } from "./capture";

describe("requiredMissing", () => {
  it("returns labels of empty/blank fields only", () => {
    const missing = requiredMissing({
      a: { value: "ok", label: "A" },
      b: { value: "", label: "B" },
      c: { value: "  ", label: "C" },
      d: { value: null, label: "D" },
      e: { value: 0, label: "E" },
    });
    expect(missing).toEqual(["B", "C", "D"]); // 0 counts as present
  });
  it("returns [] when all present", () => {
    expect(requiredMissing({ a: { value: "x", label: "A" } })).toEqual([]);
  });
});

describe("capture constants", () => {
  it("expose outcome + result codes", () => {
    expect(TASK_OUTCOMES).toContain("resolved");
    expect(REACTIVATION_RESULTS).toContain("booked");
  });
});

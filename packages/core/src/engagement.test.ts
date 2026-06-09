import { describe, it, expect } from "vitest";
import { medicationCheckpoints, therapySessionDates, therapyProgress, adherenceTone } from "./engagement";

describe("medicationCheckpoints", () => {
  it("30-day course → start, mid, refill (~80%) ascending", () => {
    const cp = medicationCheckpoints("2026-06-01", 30);
    expect(cp.map((c) => c.kind)).toEqual(["start", "compliance", "refill"]);
    expect(cp[0].dueDate).toBe("2026-06-01");          // day 1
    expect(cp[1].dueDate).toBe("2026-06-16");          // +15 (floor(30/2))
    expect(cp[2].dueDate).toBe("2026-06-25");          // +24 (round(30*0.8))
    // strictly ascending
    expect(cp[0].dueDate < cp[1].dueDate && cp[1].dueDate < cp[2].dueDate).toBe(true);
  });

  it("very short course (≤2 days) → start only", () => {
    expect(medicationCheckpoints("2026-06-01", 2).map((c) => c.kind)).toEqual(["start"]);
  });

  it("short course collapses duplicate dates, stays ascending", () => {
    const cp = medicationCheckpoints("2026-06-01", 3); // mid=+1, refill=+2 (round(2.4))
    const dates = cp.map((c) => c.dueDate);
    expect(new Set(dates).size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) expect(dates[i] > dates[i - 1]).toBe(true);
  });
});

describe("therapySessionDates", () => {
  it("spaces sessions by interval", () => {
    expect(therapySessionDates("2026-06-01", 3, 7)).toEqual(["2026-06-01", "2026-06-08", "2026-06-15"]);
  });
  it("zero sessions → empty", () => {
    expect(therapySessionDates("2026-06-01", 0, 7)).toEqual([]);
  });
});

describe("therapyProgress", () => {
  it("computes completed/missed/pending/pct", () => {
    expect(therapyProgress(10, 7, 1)).toEqual({ completed: 7, missed: 1, pending: 2, pct: 70 });
  });
  it("no divide-by-zero on 0 total", () => {
    expect(therapyProgress(0, 0, 0)).toEqual({ completed: 0, missed: 0, pending: 0, pct: 0 });
  });
});

describe("adherenceTone", () => {
  it("maps states to tones", () => {
    expect(adherenceTone("on_track")).toBe("green");
    expect(adherenceTone("missed_doses")).toBe("amber");
    expect(adherenceTone("needs_refill")).toBe("amber");
    expect(adherenceTone("side_effects")).toBe("red");
    expect(adherenceTone("needs_consult")).toBe("red");
    expect(adherenceTone("unknown")).toBe("slate");
  });
});

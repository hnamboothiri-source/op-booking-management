import { describe, it, expect } from "vitest";
import { overdueAgeDays, overdueBucket, escalationLevel, funnelRate } from "./callcenter";

const D = (iso: string) => new Date(iso);

describe("overdueAgeDays", () => {
  const now = D("2026-06-10T14:00:00Z");
  it("counts whole days overdue by calendar day", () => {
    expect(overdueAgeDays(D("2026-06-09T23:00:00Z"), now)).toBe(1);
    expect(overdueAgeDays(D("2026-06-03T00:00:00Z"), now)).toBe(7);
  });
  it("is 0 for today or future due dates", () => {
    expect(overdueAgeDays(D("2026-06-10T01:00:00Z"), now)).toBe(0);
    expect(overdueAgeDays(D("2026-06-12T00:00:00Z"), now)).toBe(0);
  });
});

describe("overdueBucket", () => {
  it("buckets by age", () => {
    expect(overdueBucket(1)).toBe("1d");
    expect(overdueBucket(2)).toBe("2-3d");
    expect(overdueBucket(3)).toBe("2-3d");
    expect(overdueBucket(4)).toBe("4-6d");
    expect(overdueBucket(6)).toBe("4-6d");
    expect(overdueBucket(7)).toBe("7d+");
    expect(overdueBucket(30)).toBe("7d+");
  });
});

describe("escalationLevel", () => {
  it("maps age to L1–L4 at the boundaries", () => {
    expect(escalationLevel(0)).toBe(1);
    expect(escalationLevel(2)).toBe(1);
    expect(escalationLevel(3)).toBe(2);
    expect(escalationLevel(6)).toBe(2);
    expect(escalationLevel(7)).toBe(3);
    expect(escalationLevel(13)).toBe(3);
    expect(escalationLevel(14)).toBe(4);
  });
});

describe("funnelRate", () => {
  it("rounds the percentage and guards divide-by-zero", () => {
    expect(funnelRate(40, 100)).toBe(40);
    expect(funnelRate(1, 3)).toBe(33);
    expect(funnelRate(5, 0)).toBe(0);
  });
});

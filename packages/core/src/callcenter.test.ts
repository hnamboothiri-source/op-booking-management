import { describe, it, expect } from "vitest";
import { overdueAgeDays, overdueBucket, escalationLevel, funnelRate, deskForSource, deskForFollowUp, deskLabel, CALL_DESKS, effectiveTier, slaTargetMinutes, slaState } from "./callcenter";

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

describe("call-centre desks", () => {
  it("routes direct-call sources to reception, everything else to back office", () => {
    expect(deskForSource("phone")).toBe("reception");
    expect(deskForSource("walk_in")).toBe("reception");
    expect(deskForSource("website")).toBe("back_office");
    expect(deskForSource("whatsapp")).toBe("back_office");
    expect(deskForSource("email")).toBe("back_office");
    expect(deskForSource(null)).toBe("back_office");
  });
  it("routes follow-ups to front office", () => {
    expect(deskForFollowUp()).toBe("front_office");
  });
  it("labels desks and falls back", () => {
    expect(deskLabel("reception")).toBe("Reception");
    expect(deskLabel("front_office")).toBe("Front Office");
    expect(deskLabel(undefined)).toBe("—");
    expect(CALL_DESKS).toHaveLength(3);
  });
});

describe("lead tiers + SLA", () => {
  it("prefers a valid manual override, else derived, else cold", () => {
    expect(effectiveTier("hot", "cold")).toBe("hot");
    expect(effectiveTier(null, "warm")).toBe("warm");
    expect(effectiveTier("garbage", "warm")).toBe("warm");
    expect(effectiveTier(undefined, null)).toBe("cold");
  });
  it("maps tier to SLA minutes", () => {
    expect(slaTargetMinutes("hot")).toBe(15);
    expect(slaTargetMinutes("warm")).toBe(120);
    expect(slaTargetMinutes("cold")).toBe(1440);
  });
  it("computes SLA state at the boundaries", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const ago = (min: number) => new Date(now.getTime() - min * 60_000);
    expect(slaState("hot", ago(5), now)).toBe("on_track");   // 5 of 15
    expect(slaState("hot", ago(12), now)).toBe("at_risk");   // >75% of 15
    expect(slaState("hot", ago(20), now)).toBe("breached");  // over 15
    expect(slaState("warm", ago(30), now)).toBe("on_track"); // 30 of 120
    expect(slaState("cold", ago(2000), now)).toBe("breached");
  });
});

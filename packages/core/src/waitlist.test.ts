import { describe, it, expect } from "vitest";
import { sortWaitlist, nextToPromote } from "./waitlist";

const e = (priority: number, day: number) => ({ priority, createdAt: new Date(2026, 5, day), id: `${priority}-${day}` });

describe("waitlist ordering", () => {
  it("orders by priority desc then FIFO", () => {
    const ordered = sortWaitlist([e(0, 3), e(1, 5), e(0, 1), e(1, 2)]);
    expect(ordered.map((x) => x.id)).toEqual(["1-2", "1-5", "0-1", "0-3"]);
  });

  it("promotes the highest-priority earliest entry", () => {
    expect(nextToPromote([e(0, 1), e(2, 9), e(2, 4)])?.id).toBe("2-4");
    expect(nextToPromote([])).toBeUndefined();
  });

  it("does not mutate the input", () => {
    const input = [e(0, 3), e(1, 1)];
    sortWaitlist(input);
    expect(input.map((x) => x.id)).toEqual(["0-3", "1-1"]);
  });
});

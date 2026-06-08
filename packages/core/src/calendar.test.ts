import { describe, it, expect } from "vitest";
import { layoutCalendar, type CalendarItem } from "./calendar";

const item = (id: string, column: string, startTime: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id, column, startTime, state: "open", ...extra,
});

describe("layoutCalendar", () => {
  it("orders times chronologically and groups by column", () => {
    const out = layoutCalendar([
      item("a", "dr1", "10:00"),
      item("b", "dr1", "09:00"),
      item("c", "dr2", "09:30"),
    ]);
    expect(out.times).toEqual(["09:00", "09:30", "10:00"]);
    expect(out.columns.sort()).toEqual(["dr1", "dr2"]);
    expect(out.grid["dr1"]["09:00"].map((i) => i.id)).toEqual(["b"]);
    expect(out.grid["dr2"]["09:30"].map((i) => i.id)).toEqual(["c"]);
  });

  it("respects an explicit column order and appends extras alphabetically", () => {
    const out = layoutCalendar(
      [item("a", "drB", "09:00"), item("b", "drA", "09:00"), item("c", "drZ", "09:00")],
      ["drA", "drB"], // drZ not listed → appended
    );
    expect(out.columns).toEqual(["drA", "drB", "drZ"]);
  });

  it("stacks multiple items in the same cell", () => {
    const out = layoutCalendar([item("a", "dr1", "09:00"), item("b", "dr1", "09:00", { state: "booked" })]);
    expect(out.grid["dr1"]["09:00"]).toHaveLength(2);
  });

  it("handles an empty input", () => {
    const out = layoutCalendar([]);
    expect(out.columns).toEqual([]);
    expect(out.times).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  canTransitionBooking, nextBookingStatuses, occupiesSlot, releasesSlot,
  slotStatusFor, hasCapacity, generateSlotTimes, nextQueueToken, roomConflict, dueReminders,
  splitSessionSlots, weekOfMonthLabel, minutesBetween, slotUtilisation,
} from "./booking";
import { conversionRate, isConverted, isClosedStage } from "./leads";

describe("booking transitions", () => {
  it("walks the happy path booked → completed", () => {
    expect(canTransitionBooking("booked", "confirmed")).toBe(true);
    expect(canTransitionBooking("confirmed", "arrived")).toBe(true);
    expect(canTransitionBooking("arrived", "in_consultation")).toBe(true);
    expect(canTransitionBooking("in_consultation", "completed")).toBe(true);
  });
  it("blocks illegal and post-terminal transitions", () => {
    expect(canTransitionBooking("completed", "booked")).toBe(false);
    expect(canTransitionBooking("no_show", "confirmed")).toBe(false);
    expect(canTransitionBooking("booked", "completed")).toBe(false);
  });
  it("lists next statuses", () => {
    expect(nextBookingStatuses("in_consultation")).toEqual(["completed"]);
    expect(nextBookingStatuses("completed")).toEqual([]);
  });
});

describe("slot capacity", () => {
  it("occupies vs releases", () => {
    expect(occupiesSlot("confirmed")).toBe(true);
    expect(occupiesSlot("cancelled")).toBe(false);
    expect(releasesSlot("no_show")).toBe(true);
    expect(releasesSlot("completed")).toBe(false);
  });
  it("computes status and capacity", () => {
    expect(slotStatusFor(2, 3)).toBe("open");
    expect(slotStatusFor(3, 3)).toBe("full");
    expect(hasCapacity(2, 3)).toBe(true);
    expect(hasCapacity(3, 3)).toBe(false);
  });
});

describe("generateSlotTimes", () => {
  it("splits a session into fixed slots", () => {
    expect(generateSlotTimes("09:00", "10:00", 20)).toEqual([
      { start: "09:00", end: "09:20" },
      { start: "09:20", end: "09:40" },
      { start: "09:40", end: "10:00" },
    ]);
  });
  it("drops a trailing partial slot", () => {
    expect(generateSlotTimes("09:00", "09:50", 20)).toHaveLength(2);
  });
});

describe("nextQueueToken", () => {
  it("starts at 1 and increments past the max issued", () => {
    expect(nextQueueToken([])).toBe(1);
    expect(nextQueueToken([1, 2, 3])).toBe(4);
    expect(nextQueueToken([3, 1, 2])).toBe(4);
  });
});

describe("roomConflict", () => {
  it("flags a room already used at the same start time", () => {
    const existing = [{ startTime: "09:00" }, { startTime: "09:20" }];
    expect(roomConflict(existing, "09:00")).toBe(true);
    expect(roomConflict(existing, "09:40")).toBe(false);
    expect(roomConflict([], "09:00")).toBe(false);
  });
});

describe("splitSessionSlots", () => {
  it("divides a window into N equal back-to-back slots", () => {
    const s = splitSessionSlots("09:00", "12:30", 7);
    expect(s).toHaveLength(7);
    expect(s[0]).toEqual({ start: "09:00", end: "09:30" });
    expect(s[6].end).toBe("12:30");
  });
  it("returns one slot for count <= 1 or bad window", () => {
    expect(splitSessionSlots("09:00", "12:00", 1)).toEqual([{ start: "09:00", end: "12:00" }]);
    expect(splitSessionSlots("12:00", "09:00", 3)).toEqual([{ start: "12:00", end: "09:00" }]);
  });
});

describe("minutesBetween / slotUtilisation", () => {
  it("computes minutes and guards order", () => {
    expect(minutesBetween("09:00", "12:30")).toBe(210);
    expect(minutesBetween("14:00", "18:00")).toBe(240);
    expect(minutesBetween("12:00", "09:00")).toBe(0);
  });
  it("computes clamped utilisation", () => {
    expect(slotUtilisation(2, 4)).toBe(50);
    expect(slotUtilisation(5, 4)).toBe(100);
    expect(slotUtilisation(3, 0)).toBe(0);
  });
});

describe("weekOfMonthLabel", () => {
  it("formats rotation tags", () => {
    expect(weekOfMonthLabel("1,3")).toBe("1st & 3rd");
    expect(weekOfMonthLabel("2")).toBe("2nd");
    expect(weekOfMonthLabel("1&5")).toBe("1st & 5th");
    expect(weekOfMonthLabel(null)).toBe("");
  });
});

describe("dueReminders", () => {
  const now = new Date("2026-06-10T08:00:00Z");
  const base = { sentKinds: [] as string[] };
  it("sends day-before for tomorrow and morning for today", () => {
    const due = dueReminders([
      { bookingId: "a", appointmentDate: "2026-06-11", status: "booked", ...base }, // tomorrow
      { bookingId: "b", appointmentDate: "2026-06-10", status: "confirmed", ...base }, // today
      { bookingId: "c", appointmentDate: "2026-06-15", status: "booked", ...base }, // later
    ], now);
    expect(due).toEqual([
      { bookingId: "a", kind: "day_before" },
      { bookingId: "b", kind: "morning" },
    ]);
  });
  it("skips already-sent and non-open statuses", () => {
    const due = dueReminders([
      { bookingId: "a", appointmentDate: "2026-06-11", status: "booked", sentKinds: ["day_before"] },
      { bookingId: "b", appointmentDate: "2026-06-10", status: "cancelled", sentKinds: [] },
      { bookingId: "c", appointmentDate: "2026-06-10", status: "completed", sentKinds: [] },
    ], now);
    expect(due).toEqual([]);
  });
});

describe("lead funnel helpers", () => {
  it("conversion rate with one decimal", () => {
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(0, 0)).toBe(0);
  });
  it("classifies stages", () => {
    expect(isConverted("appointment_booked")).toBe(true);
    expect(isClosedStage("lost")).toBe(true);
    expect(isClosedStage("new_lead")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  canTransitionBooking, nextBookingStatuses, occupiesSlot, releasesSlot,
  slotStatusFor, hasCapacity, generateSlotTimes,
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

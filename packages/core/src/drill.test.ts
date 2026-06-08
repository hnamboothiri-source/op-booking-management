import { describe, it, expect } from "vitest";
import { filterToWhereValue, pickAllowedFilters, filtersToQuery, relativeDateRange, parseBool } from "./drill";

describe("filterToWhereValue", () => {
  it("returns a bare value for a single token (equality)", () => {
    expect(filterToWhereValue("dormant")).toBe("dormant");
  });

  it("returns an { in } clause for comma-separated values", () => {
    expect(filterToWhereValue("appointment_booked,converted_to_patient")).toEqual({
      in: ["appointment_booked", "converted_to_patient"],
    });
  });

  it("trims whitespace and drops empty segments", () => {
    expect(filterToWhereValue(" pending , booked , ")).toEqual({ in: ["pending", "booked"] });
    expect(filterToWhereValue("completed,")).toBe("completed");
  });

  it("yields an empty-string equality for an empty value", () => {
    expect(filterToWhereValue("")).toBe("");
  });
});

describe("pickAllowedFilters", () => {
  it("keeps only allowed, non-empty keys", () => {
    const picked = pickAllowedFilters(
      { status: "no_show", doctorId: "abc", evil: "1=1", blank: "  " },
      ["status", "doctorId", "date"],
    );
    expect(picked).toEqual({ status: "no_show", doctorId: "abc" });
  });

  it("returns an empty object when nothing matches", () => {
    expect(pickAllowedFilters({ foo: "bar" }, ["status"])).toEqual({});
  });
});

describe("filtersToQuery", () => {
  it("builds a stable, encoded, sorted query string", () => {
    expect(filtersToQuery({ status: "no_show", doctorId: "a b" })).toBe("doctorId=a%20b&status=no_show");
  });

  it("omits blank values and returns empty for no filters", () => {
    expect(filtersToQuery({ status: "  ", x: "" })).toBe("");
    expect(filtersToQuery({})).toBe("");
  });
});

describe("relativeDateRange", () => {
  // Fixed "now" mid-afternoon to prove it snaps to the calendar day, not the instant.
  const now = new Date("2026-06-08T14:30:00.000Z");

  it("today spans [midnight today, midnight tomorrow)", () => {
    expect(relativeDateRange("today", now)).toEqual({
      gte: new Date("2026-06-08T00:00:00.000Z"),
      lt: new Date("2026-06-09T00:00:00.000Z"),
    });
  });

  it("overdue is strictly before midnight today", () => {
    expect(relativeDateRange("overdue", now)).toEqual({ lt: new Date("2026-06-08T00:00:00.000Z") });
  });

  it("upcoming starts at midnight tomorrow", () => {
    expect(relativeDateRange("upcoming", now)).toEqual({ gte: new Date("2026-06-09T00:00:00.000Z") });
  });

  it("returns null for an unknown token", () => {
    expect(relativeDateRange("whenever", now)).toBeNull();
  });
});

describe("parseBool", () => {
  it("parses clean true/false", () => {
    expect(parseBool("true")).toBe(true);
    expect(parseBool("false")).toBe(false);
  });
  it("returns undefined for anything else", () => {
    expect(parseBool("1")).toBeUndefined();
    expect(parseBool("")).toBeUndefined();
    expect(parseBool("TRUE")).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { filterToWhereValue, pickAllowedFilters, filtersToQuery } from "./drill";

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

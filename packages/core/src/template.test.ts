import { describe, it, expect } from "vitest";
import { renderTemplate, templatePlaceholders } from "./template";

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(renderTemplate("Hi {{name}}, see you at {{place}}.", { name: "Lakshmi", place: "Kochi" }))
      .toBe("Hi Lakshmi, see you at Kochi.");
  });
  it("collapses unknown/empty keys to empty string", () => {
    expect(renderTemplate("Hi {{name}}{{missing}}!", { name: "Ravi", missing: null })).toBe("Hi Ravi!");
  });
  it("tolerates spacing inside braces", () => {
    expect(renderTemplate("{{ name }}", { name: "A" })).toBe("A");
  });
});

describe("templatePlaceholders", () => {
  it("lists unique keys in order", () => {
    expect(templatePlaceholders("{{name}} {{place}} {{name}}")).toEqual(["name", "place"]);
  });
});

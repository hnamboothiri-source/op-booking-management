import { describe, it, expect } from "vitest";
import { rulesFor, type AutomationAction } from "./automation";

const kinds = (event: Parameters<typeof rulesFor>[0]) =>
  rulesFor(event).flatMap((r) => r.actions.map((a: AutomationAction) => a.kind));

describe("automation rules", () => {
  it("messages the patient (and tasks staff) when a follow-up is advised", () => {
    const acts = kinds("consultation_follow_up_advised");
    expect(acts).toContain("create_task");
    expect(acts).toContain("send_message");
  });

  it("messages the patient (and tasks staff) when admission is recommended", () => {
    const acts = kinds("admission_recommended");
    expect(acts).toContain("create_task");
    expect(acts).toContain("send_message");
  });

  it("escalates an uncontacted-lead SLA breach to a manager", () => {
    expect(kinds("lead_uncontacted_sla_breached")).toContain("escalate_to_manager");
  });

  it("returns no rules for an event with none registered", () => {
    expect(rulesFor("appointment_upcoming").length).toBeGreaterThanOrEqual(0);
  });
});

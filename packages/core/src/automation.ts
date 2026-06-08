/**
 * Automation rule definitions (master doc §10). These are declarative triggers;
 * the Phase 0+ job runner / API layer evaluates them against domain events.
 */

export type DomainEvent =
  | "website_enquiry_received"
  | "missed_call_logged"
  | "duplicate_mobile_detected"
  | "lead_uncontacted_sla_breached"
  | "appointment_created"
  | "appointment_upcoming"
  | "appointment_no_show"
  | "consultation_follow_up_advised"
  | "admission_recommended"
  | "follow_up_missed"
  | "patient_became_dormant"
  | "patient_converted";

export type AutomationAction =
  | { kind: "create_lead" }
  | { kind: "create_task"; taskType: string }
  | { kind: "alert_user" }
  | { kind: "escalate_to_manager" }
  | { kind: "send_message"; channel: "whatsapp" | "sms" | "email"; template: string }
  | { kind: "attach_campaign_source" }
  | { kind: "link_revenue_to_campaign" };

export interface AutomationRule {
  id: string;
  on: DomainEvent;
  group: "lead" | "appointment" | "follow_up" | "campaign";
  actions: AutomationAction[];
}

export const AUTOMATION_RULES: AutomationRule[] = [
  // Lead
  { id: "lead.website-enquiry", on: "website_enquiry_received", group: "lead",
    actions: [{ kind: "create_lead" }, { kind: "attach_campaign_source" }] },
  { id: "lead.missed-call", on: "missed_call_logged", group: "lead",
    actions: [{ kind: "create_task", taskType: "call_back_patient" }] },
  { id: "lead.duplicate-mobile", on: "duplicate_mobile_detected", group: "lead",
    actions: [{ kind: "alert_user" }] },
  { id: "lead.sla-breach", on: "lead_uncontacted_sla_breached", group: "lead",
    actions: [{ kind: "escalate_to_manager" }] },

  // Appointment
  { id: "appt.confirmation", on: "appointment_created", group: "appointment",
    actions: [{ kind: "send_message", channel: "whatsapp", template: "appointment_confirmation" }] },
  { id: "appt.reminder", on: "appointment_upcoming", group: "appointment",
    actions: [{ kind: "send_message", channel: "whatsapp", template: "appointment_reminder" }] },
  { id: "appt.no-show", on: "appointment_no_show", group: "appointment",
    actions: [{ kind: "create_task", taskType: "call_back_patient" }] },

  // Follow-up
  { id: "fu.doctor-advice", on: "consultation_follow_up_advised", group: "follow_up",
    actions: [{ kind: "create_task", taskType: "follow_up_medicine" }, { kind: "send_message", channel: "whatsapp", template: "follow_up_reminder" }] },
  { id: "fu.admission-rec", on: "admission_recommended", group: "follow_up",
    actions: [{ kind: "create_task", taskType: "follow_up_admission" }, { kind: "send_message", channel: "whatsapp", template: "admission_recommendation" }] },
  { id: "fu.missed", on: "follow_up_missed", group: "follow_up",
    actions: [{ kind: "escalate_to_manager" }] },
  { id: "fu.dormant", on: "patient_became_dormant", group: "follow_up",
    actions: [{ kind: "create_task", taskType: "contact_dormant_patient" }] },

  // Campaign
  { id: "campaign.revenue", on: "patient_converted", group: "campaign",
    actions: [{ kind: "link_revenue_to_campaign" }] },
];

/** Return the rules that fire for a given domain event. */
export function rulesFor(event: DomainEvent): AutomationRule[] {
  return AUTOMATION_RULES.filter((r) => r.on === event);
}

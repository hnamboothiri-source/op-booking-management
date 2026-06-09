/**
 * Declarative description of the 20 master-data sets (master doc §7). One
 * registry drives generic list/create/edit/delete UI + server actions, so we
 * never hand-write 20 near-identical CRUD screens.
 *
 * `model` is the Prisma delegate name. Lookup masters get full generic CRUD;
 * operational masters (camps, campaigns, slots) are surfaced here for
 * completeness but are managed inside their own modules in later phases.
 */

export type FieldType = "text" | "number" | "money" | "boolean" | "select" | "textarea" | "ref" | "date";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[]; // for `select`
  ref?: "branch" | "department" | "marketingChannel"; // for `ref`
}

export interface MasterDef {
  key: string;
  label: string;
  model: string; // Prisma delegate, e.g. "branch"
  fields: FieldDef[];
  listColumns: string[];
  /** When set, the master is managed in a module rather than via generic CRUD. */
  managedInModule?: string;
}

const ROLE_OPTIONS = [
  "administrator", "management", "call_center_executive", "call_center_manager",
  "front_office", "doctor", "optometry_staff", "lab_staff", "pharmacy_staff",
  "admission_counsellor", "patient_success_executive", "marketing_team",
  "branch_manager", "camp_coordinator", "mobile_clinic_coordinator",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const opts = (...vals: string[]) => vals.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

export const MASTERS: MasterDef[] = [
  {
    key: "branches", label: "Branch", model: "branch",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "code", label: "Code", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "code", "location", "active"],
  },
  {
    key: "departments", label: "Department", model: "department",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "code", label: "Code", type: "text" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "code", "active"],
  },
  {
    key: "doctors", label: "Doctor", model: "doctor",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "designation", label: "Designation", type: "text" },
      { name: "registrationNo", label: "Registration No", type: "text" },
      { name: "dailyTarget", label: "Daily target", type: "number" },
      { name: "newTargetPct", label: "New booking target %", type: "number" },
      { name: "followupTargetPct", label: "Follow-up target %", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "designation", "dailyTarget", "newTargetPct", "followupTargetPct", "active"],
  },
  {
    key: "consultation-rooms", label: "Consultation Room", model: "consultationRoom",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "departmentId", label: "Department", type: "ref", ref: "department" },
      { name: "branchId", label: "Branch", type: "ref", ref: "branch" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "active"],
  },
  {
    key: "staff", label: "Staff / User", model: "staffUser",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "email", label: "Email", type: "text", required: true },
      { name: "role", label: "Role", type: "select", required: true, options: ROLE_OPTIONS },
      { name: "branchId", label: "Branch", type: "ref", ref: "branch" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "email", "role", "active"],
  },
  {
    key: "lead-sources", label: "Lead Source", model: "leadSourceMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "active"],
  },
  {
    key: "diseases", label: "Disease / Complaint", model: "diseaseMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "active"],
  },
  {
    key: "services", label: "Service", model: "serviceMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "price", label: "Price (₹)", type: "money" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "price", "active"],
  },
  {
    key: "referral-sources", label: "Referral Source", model: "referralSourceMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "active"],
  },
  {
    key: "organizations", label: "Organization", model: "organization",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "type", label: "Type", type: "select", required: true,
        options: opts("company", "school", "college", "ngo", "panchayat", "religious_institution", "association", "senior_citizen_group"),
      },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "type", "active"],
  },
  {
    key: "communication-templates", label: "Communication Template", model: "communicationTemplate",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "channel", label: "Channel", type: "select", required: true, options: opts("whatsapp", "sms", "email", "phone_call", "app_notification") },
      { name: "language", label: "Language", type: "text" },
      { name: "body", label: "Body", type: "textarea", required: true },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "channel", "language", "active"],
  },
  {
    key: "follow-up-types", label: "Follow-up Type", model: "followUpTypeMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "type", label: "Type", type: "select", required: true, options: opts("consultation_review", "medicine", "test", "admission", "surgery_procedure", "long_term_treatment", "annual_checkup", "dormant_reactivation", "ip_readmission") },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "type", "active"],
  },
  {
    key: "admission-packages", label: "Admission Package", model: "admissionPackageMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "estimatedCost", label: "Estimated Cost (₹)", type: "money" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "estimatedCost", "active"],
  },
  {
    key: "task-types", label: "Task Type", model: "taskTypeMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "type", label: "Type", type: "select", required: true, options: opts("call_back_patient", "confirm_appointment", "follow_up_admission", "follow_up_test", "follow_up_medicine", "contact_dormant_patient", "camp_follow_up", "doctor_referral_follow_up") },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "type", "active"],
  },
  {
    key: "reasons", label: "Reason (lost/no-show/rejection/cancellation)", model: "reasonMaster",
    fields: [
      { name: "category", label: "Category", type: "select", required: true, options: opts("lost_lead", "no_show", "admission_rejection", "cancellation") },
      { name: "label", label: "Label", type: "text", required: true },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["category", "label", "active"],
  },

  {
    key: "marketing-channels", label: "Marketing Channel", model: "marketingChannelMaster",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "pricingModel", label: "Pricing model", type: "select", required: true, options: opts("cpm", "cpc", "flat", "per_post") },
      { name: "baseRate", label: "Base rate (₹) — per 1,000 reach for CPM", type: "money" },
      { name: "minReach", label: "Min reach", type: "number" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "pricingModel", "baseRate", "active"],
  },
  {
    key: "channel-offers", label: "Channel Seasonal Offer", model: "channelSeasonalOffer",
    fields: [
      { name: "channelMasterId", label: "Channel", type: "ref", ref: "marketingChannel", required: true },
      { name: "name", label: "Offer name", type: "text", required: true },
      { name: "fromDate", label: "From", type: "date", required: true },
      { name: "toDate", label: "To", type: "date", required: true },
      { name: "discountPct", label: "Discount %", type: "number" },
      { name: "bonusReachPct", label: "Bonus reach %", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["name", "fromDate", "toDate", "active"],
  },

  {
    key: "call-checklists", label: "Call Checklist Item", model: "callChecklistItem",
    fields: [
      { name: "label", label: "Talking point / question", type: "text", required: true },
      { name: "desk", label: "Desk", type: "select", required: true, options: opts("reception", "front_office", "back_office", "any") },
      { name: "section", label: "Section", type: "select", options: opts("identity", "clinical", "commercial", "next_step", "general") },
      { name: "promptHint", label: "Prompt / what to say", type: "textarea" },
      { name: "mandatory", label: "Mandatory (must be answered)", type: "boolean" },
      { name: "responseType", label: "Response type", type: "select", options: opts("checkbox", "yes_no_na", "short_text") },
      { name: "sortOrder", label: "Sort order", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
    ],
    listColumns: ["label", "desk", "section", "active"],
  },

  // --- Operational masters surfaced for completeness (managed in their module) ---
  { key: "user-roles", label: "User Role", model: "_enum", fields: [], listColumns: [], managedInModule: "Roles are a fixed enum (Module 16) — see Roles reference" },
  { key: "campaigns", label: "Campaign", model: "campaign", fields: [], listColumns: [], managedInModule: "Marketing module (Phase 4)" },
  { key: "camps", label: "Camp", model: "camp", fields: [], listColumns: [], managedInModule: "Camp module (Phase 3)" },
  { key: "mobile-clinic-routes", label: "Mobile Clinic Route", model: "mobileClinic", fields: [], listColumns: [], managedInModule: "Mobile Clinic module (Phase 3)" },
  { key: "appointment-slots", label: "Appointment Slot", model: "timeSlot", fields: [], listColumns: [], managedInModule: "Appointment module (Phase 1) — generated from doctor schedules" },
];

export function getMaster(key: string): MasterDef | undefined {
  return MASTERS.find((m) => m.key === key);
}

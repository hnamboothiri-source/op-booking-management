/**
 * Seed master data + a representative lifecycle record.
 * Idempotent: uses upserts / stable IDs where practical so it can re-run.
 * Run: npm run db:seed   (after db:up and db:migrate)
 */
import { PrismaClient, Role, BranchType, ReasonCategory, FollowUpType, TaskType, CampaignType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Default password for all seeded staff (dev/demo only).
const DEMO_PASSWORD = "Sreedhareeyam@1";

async function main() {
  // --- Companies (group = two legal entities) ---
  const saeh = await prisma.company.upsert({
    where: { code: "SAEH" },
    update: {},
    create: { name: "Sreedhareeyam Ayurvedic Eye Hospital and Research Centre Pvt Ltd", shortName: "Eye Hospital & Research Centre", code: "SAEH" },
  });
  const saec = await prisma.company.upsert({
    where: { code: "SAEC" },
    update: {},
    create: { name: "Sreedhareeyam Ayurvedic Eye Clinic and Panchakarma Centre Pvt Ltd", shortName: "Eye Clinic & Panchakarma", code: "SAEC" },
  });

  // --- Branches (centres) ---
  // Module allotment per centre type (empty = ALL modules; flagship runs everything).
  const OP_MODULES = ["leads", "call-center", "appointments", "consultations", "follow-ups", "patients", "communication"];
  const HOSPITAL_MODULES = [...OP_MODULES, "camps", "mobile-clinics", "admissions", "retention", "referrals", "conversion"];
  const main = await prisma.branch.upsert({
    where: { name: "Main Hospital" },
    update: { companyId: saeh.id, type: BranchType.flagship_hospital, enabledModules: [] },
    create: { name: "Main Hospital", code: "MAIN", location: "Koothattukulam", companyId: saeh.id, type: BranchType.flagship_hospital, enabledModules: [] },
  });
  // The legacy "Kochi Branch" row is the SAEC Ernakulam hospital.
  const legacyKochi = await prisma.branch.findUnique({ where: { code: "KOC" } });
  if (legacyKochi) {
    await prisma.branch.update({ where: { id: legacyKochi.id }, data: { name: "Ernakulam Hospital", companyId: saec.id, type: BranchType.hospital, enabledModules: HOSPITAL_MODULES } });
  } else {
    await prisma.branch.upsert({
      where: { name: "Ernakulam Hospital" },
      update: { companyId: saec.id, type: BranchType.hospital, enabledModules: HOSPITAL_MODULES },
      create: { name: "Ernakulam Hospital", code: "KOC", location: "Ernakulam", companyId: saec.id, type: BranchType.hospital, enabledModules: HOSPITAL_MODULES },
    });
  }
  const saecCentres: [string, string, string, BranchType][] = [
    ["Kannur Hospital", "KNR", "Kannur", BranchType.hospital],
    ["Bangalore Hospital", "BLR", "Bangalore", BranchType.hospital],
    ["New Delhi Hospital", "DEL", "New Delhi", BranchType.hospital],
    ["Visakhapatnam Hospital", "VSK", "Visakhapatnam", BranchType.hospital],
    ["Mumbai Hospital", "MUM", "Mumbai", BranchType.hospital],
    ["Chennai Hospital", "CHE", "Chennai", BranchType.hospital],
    ["Kottayam OP Centre", "KTM-OP", "Kottayam", BranchType.op_centre],
    ["Trivandrum OP Centre", "TVM-OP", "Trivandrum", BranchType.op_centre],
  ];
  for (const [name, code, location, type] of saecCentres) {
    const enabledModules = type === BranchType.op_centre ? OP_MODULES : HOSPITAL_MODULES;
    await prisma.branch.upsert({
      where: { name },
      update: { companyId: saec.id, type, enabledModules },
      create: { name, code, location, companyId: saec.id, type, enabledModules },
    });
  }

  // --- Departments (aligned with hospital list) ---
  const departments = [
    "General",
    "Ophthalmology",
    "Skin & Allergy",
    "Orthopedic",
    "Gynecology",
    "Dermatology",
    "Neurology",
    "Lifestyle diseases",
  ];
  for (const name of departments) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }
  const ophth = await prisma.department.findUniqueOrThrow({ where: { name: "Ophthalmology" } });

  // --- Doctors (consultant roster) with daily patient targets ---
  const docs: [string, string, string, number][] = [
    ["Dr. Menon", "Senior Consultant", "KMC-1001", 20],
    ["Dr. Pillai", "Consultant", "KMC-1002", 15],
    ["Dr. Thomas", "Medical Officer", "KMC-1003", 25],
  ];
  for (const [name, designation, registrationNo, dailyTarget] of docs) {
    await prisma.doctor.upsert({ where: { registrationNo }, update: { dailyTarget }, create: { name, designation, registrationNo, dailyTarget } });
  }

  // --- Consultation rooms (Module 3 room allocation) ---
  for (const name of ["Room 1", "Room 2", "Room 3"]) {
    const exists = await prisma.consultationRoom.findFirst({ where: { name } });
    if (!exists) await prisma.consultationRoom.create({ data: { name, departmentId: ophth.id, branchId: main.id } });
  }

  // --- Lead sources (acquisition channels) ---
  const sources = [
    "social_media", "google_ads", "website", "phone", "whatsapp", "email",
    "doctor_referral", "patient_referral", "branch_referral", "camp",
    "mobile_clinic", "corporate", "school_college", "ngo", "walk_in",
  ];
  for (const name of sources) {
    await prisma.leadSourceMaster.upsert({ where: { name }, update: {}, create: { name } });
  }
  const websiteSrc = await prisma.leadSourceMaster.findUniqueOrThrow({ where: { name: "website" } });

  // --- Diseases / complaints ---
  for (const name of ["Cataract", "Glaucoma", "Dry eye", "Allergic conjunctivitis", "Diabetic retinopathy"]) {
    await prisma.diseaseMaster.upsert({ where: { name }, update: {}, create: { name } });
  }

  // --- Reason master (lost lead / no-show / admission rejection / cancellation) ---
  const reasons: [ReasonCategory, string][] = [
    [ReasonCategory.lost_lead, "Not interested"],
    [ReasonCategory.lost_lead, "Chose another hospital"],
    [ReasonCategory.no_show, "Forgot appointment"],
    [ReasonCategory.no_show, "Travel difficulty"],
    [ReasonCategory.admission_rejection, "Cost concern"],
    [ReasonCategory.admission_rejection, "Family decision pending"],
    [ReasonCategory.cancellation, "Patient rescheduled"],
  ];
  for (const [category, label] of reasons) {
    await prisma.reasonMaster.upsert({
      where: { category_label: { category, label } },
      update: {},
      create: { category, label },
    });
  }

  // --- Follow-up types ---
  const fuTypes: [string, FollowUpType][] = [
    ["Consultation review", FollowUpType.consultation_review],
    ["Medicine follow-up", FollowUpType.medicine],
    ["Test follow-up", FollowUpType.test],
    ["Admission follow-up", FollowUpType.admission],
    ["Annual checkup", FollowUpType.annual_checkup],
    ["Dormant reactivation", FollowUpType.dormant_reactivation],
  ];
  for (const [name, type] of fuTypes) {
    await prisma.followUpTypeMaster.upsert({ where: { name }, update: {}, create: { name, type } });
  }

  // --- Task types ---
  const taskTypes: [string, TaskType][] = [
    ["Call back patient", TaskType.call_back_patient],
    ["Confirm appointment", TaskType.confirm_appointment],
    ["Follow up admission", TaskType.follow_up_admission],
    ["Contact dormant patient", TaskType.contact_dormant_patient],
  ];
  for (const [name, type] of taskTypes) {
    await prisma.taskTypeMaster.upsert({ where: { name }, update: {}, create: { name, type } });
  }

  // --- Admission packages ---
  const pkgs: [string, number][] = [
    ["Panchakarma 7-day", 2500000],
    ["Netra Tarpana course", 1500000],
    ["Surgery + recovery", 5000000],
  ];
  for (const [name, estimatedCost] of pkgs) {
    await prisma.admissionPackageMaster.upsert({ where: { name }, update: {}, create: { name, estimatedCost } });
  }

  // --- Communication templates (Module 11) ---
  const templates: [string, "whatsapp" | "sms" | "email", string][] = [
    ["Appointment confirmation", "whatsapp", "Hi {{name}}, your appointment is confirmed. See you soon at Sreedhareeyam."],
    ["Appointment reminder", "whatsapp", "Hi {{first_name}}, reminder: your appointment is tomorrow."],
    ["Follow-up reminder", "sms", "Hi {{first_name}}, it's time for your follow-up visit. Please call us to book."],
    ["Health awareness", "whatsapp", "Dear {{name}}, protect your eyes this season — tips from Sreedhareeyam."],
  ];
  for (const [name, channel, body] of templates) {
    const exists = await prisma.communicationTemplate.findFirst({ where: { name } });
    if (!exists) await prisma.communicationTemplate.create({ data: { name, channel, body } });
  }

  // --- A dormant sample patient (Module 12 demo) ---
  await prisma.patient.upsert({
    where: { mrd: "MRD-DORMANT1" },
    update: {},
    create: { mrd: "MRD-DORMANT1", name: "Ravi Kumar", phone: "9847099001", place: "Thrissur", lifetimeVisits: 3, isNew: false, lastVisitDate: new Date("2025-09-01") },
  });

  // --- A sample organization (Module 14) ---
  const orgExists = await prisma.organization.findFirst({ where: { name: "St. Mary's School" } });
  if (!orgExists) await prisma.organization.create({ data: { name: "St. Mary's School", type: "school" } });

  // --- Staff users (one per representative role) ---
  const staff: [string, string, Role][] = [
    ["Admin User", "admin@sreedhareeyam.test", Role.administrator],
    ["Call Exec", "callexec@sreedhareeyam.test", Role.call_center_executive],
    ["Front Desk", "front@sreedhareeyam.test", Role.front_office],
    ["Dr. Menon", "menon@sreedhareeyam.test", Role.doctor],
  ];
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const [name, email, role] of staff) {
    await prisma.staffUser.upsert({
      where: { email },
      update: { passwordHash, companyId: saeh.id },
      create: { name, email, role, branchId: main.id, companyId: saeh.id, passwordHash },
    });
  }
  // --- Designations (per-company catalogues; group-level rows have companyId null) ---
  // [name, companyId, level, roleTemplate, planRank, reportsToName, approverName, moduleSlugs]
  type DesignationSeed = [string, string | null, number, Role, "staff" | "supervisor" | "manager", string | null, string | null, string[]];
  const designationSeeds: DesignationSeed[] = [
    ["Group Head / Directors", null, 1, Role.management, "manager", null, null, []],
    // SAEC — full set
    ["Executive Director / CEO", saec.id, 2, Role.company_manager, "manager", "Group Head / Directors", null, []],
    ["Patient Relations Dept Head", saec.id, 3, Role.patient_success_executive, "manager", "Executive Director / CEO", null, []],
    ["Senior Manager – Public Relations", saec.id, 4, Role.marketing_team, "manager", "Patient Relations Dept Head", null, []],
    ["Manager – Patient Relations", saec.id, 5, Role.patient_success_executive, "supervisor", "Patient Relations Dept Head", "Patient Relations Dept Head", []],
    ["Manager – Call Center", saec.id, 5, Role.call_center_manager, "supervisor", "Patient Relations Dept Head", null, []],
    ["Asst Manager – Public Relations", saec.id, 6, Role.marketing_team, "supervisor", "Senior Manager – Public Relations", null, []],
    ["Patient Relations Officer", saec.id, 6, Role.patient_success_executive, "staff", "Manager – Patient Relations", null, []],
    ["Patient Relations Executive", saec.id, 7, Role.patient_success_executive, "staff", "Patient Relations Officer", "Manager – Patient Relations", ["follow-ups", "retention", "communication", "patients"]],
    ["Public Relations Executive", saec.id, 7, Role.marketing_team, "staff", "Asst Manager – Public Relations", null, []],
    // SAEH — trimmed starter set
    ["Executive Director / CEO", saeh.id, 2, Role.company_manager, "manager", "Group Head / Directors", null, []],
    ["Patient Relations Dept Head", saeh.id, 3, Role.patient_success_executive, "manager", "Executive Director / CEO", null, []],
    ["Manager – Call Center", saeh.id, 5, Role.call_center_manager, "supervisor", "Patient Relations Dept Head", null, []],
    ["Patient Relations Officer", saeh.id, 6, Role.patient_success_executive, "staff", "Manager – Call Center", null, []],
  ];
  // Two passes: create rows first, then wire reportsTo/approver by (name, companyId).
  // Demo tool grants (admin-decided): CEOs get the org tools; Dept Heads get master plan + reports.
  const toolsFor = (name: string) =>
    name === "Executive Director / CEO" ? ["master-plan", "group", "analytics", "reports"]
    : name === "Patient Relations Dept Head" ? ["master-plan", "reports"]
    : [];
  for (const [name, companyId, level, roleTemplate, planRank, , , moduleSlugs] of designationSeeds) {
    const exists = await prisma.designation.findFirst({ where: { name, companyId } });
    if (!exists) await prisma.designation.create({ data: { name, companyId, level, roleTemplate, planRank, moduleSlugs, tools: toolsFor(name) } });
    else await prisma.designation.update({ where: { id: exists.id }, data: { level, roleTemplate, planRank, moduleSlugs, tools: toolsFor(name) } });
  }
  const findDesignation = async (name: string | null, companyId: string | null) => {
    if (!name) return null;
    // Parent designations live in the same company or at group level.
    return (await prisma.designation.findFirst({ where: { name, companyId } }))
      ?? (await prisma.designation.findFirst({ where: { name, companyId: null } }));
  };
  for (const [name, companyId, , , , reportsToName, approverName] of designationSeeds) {
    const self = await prisma.designation.findFirst({ where: { name, companyId } });
    if (!self) continue;
    const reportsTo = await findDesignation(reportsToName, companyId);
    const approver = await findDesignation(approverName, companyId);
    await prisma.designation.update({
      where: { id: self.id },
      data: { reportsToDesignationId: reportsTo?.id ?? null, approverDesignationId: approver?.id ?? null },
    });
  }
  // Per-module approval demo: Manager – Patient Relations verifies in her own
  // modules but is read-only in Communication planning.
  const mprDesignation = await prisma.designation.findFirst({ where: { name: "Manager – Patient Relations", companyId: saec.id } });
  if (mprDesignation) {
    await prisma.designation.update({ where: { id: mprDesignation.id }, data: { moduleRanks: { communication: "read_only" } } });
  }

  // Page-level demo: Patient Relations Executive limited to the retention worklist + reports.
  const preDesignation = await prisma.designation.findFirst({ where: { name: "Patient Relations Executive", companyId: saec.id } });
  if (preDesignation) {
    await prisma.designation.update({
      where: { id: preDesignation.id },
      data: {
        pageAccess: { retention: ["/retention/worklist", "/modules/retention/reports"] },
        activityTypes: { "follow-ups": ["followup_drive"], retention: ["reactivation_drive"] },
      },
    });
  }

  // Company managers (one per company — company-wide consolidation scope) + CEO designation.
  const companyManagers: [string, string, string][] = [
    ["Devi (SAEH Company Mgr)", "saeh.manager@sreedhareeyam.test", saeh.id],
    ["Hari (SAEC Company Mgr)", "saec.manager@sreedhareeyam.test", saec.id],
  ];
  for (const [name, email, companyId] of companyManagers) {
    const ceo = await prisma.designation.findFirst({ where: { name: "Executive Director / CEO", companyId } });
    await prisma.staffUser.upsert({
      where: { email },
      update: { passwordHash, companyId, designationId: ceo?.id ?? null },
      create: { name, email, role: Role.company_manager, companyId, designationId: ceo?.id ?? null, planRank: "manager", passwordHash },
    });
  }
  // Designation-hierarchy demo staff (SAEC patient relations chain).
  const demoStaff: [string, string, Role, string | null, string][] = [
    ["Adv. Mohan (Group Director)", "group.director@sreedhareeyam.test", Role.management, null, "Group Head / Directors"],
    ["Dr. Kavitha (PR Dept Head)", "pr.head@sreedhareeyam.test", Role.patient_success_executive, saec.id, "Patient Relations Dept Head"],
    ["Anitha (Mgr – Patient Relations)", "pr.manager@sreedhareeyam.test", Role.patient_success_executive, saec.id, "Manager – Patient Relations"],
    ["Vimal (Patient Relations Exec)", "pr.exec@sreedhareeyam.test", Role.patient_success_executive, saec.id, "Patient Relations Executive"],
  ];
  for (const [name, email, role, companyId, designationName] of demoStaff) {
    const des = await prisma.designation.findFirst({ where: { name: designationName, companyId } });
    await prisma.staffUser.upsert({
      where: { email },
      update: { passwordHash, companyId, designationId: des?.id ?? null },
      create: { name, email, role, companyId, designationId: des?.id ?? null, passwordHash },
    });
  }
  const callExec = await prisma.staffUser.findUniqueOrThrow({ where: { email: "callexec@sreedhareeyam.test" } });

  // --- Activity catalogue (reverse planning) ---
  const activityMasterSeeds: [string, string, number, number, string][] = [
    ["Eye screening camp", "camps", 20000_00, 8000_00, "One-day community screening camp"],
    ["Mobile clinic route", "mobile-clinics", 12000_00, 5000_00, "One van route day"],
    ["Festival lead drive", "leads", 10000_00, 2500_00, "Seasonal lead-generation push"],
    ["Reactivation call drive", "retention", 6000_00, 1000_00, "Dormant-patient call drive"],
    ["WhatsApp engagement blast", "communication", 4000_00, 800_00, "Broadcast to consented patients"],
    ["Referrer CME meet", "referrals", 8000_00, 3000_00, "CME evening for referring doctors"],
  ];
  for (const [name, moduleSlug, expectedValue, expectedCost, description] of activityMasterSeeds) {
    await prisma.activityMaster.upsert({
      where: { name },
      update: { moduleSlug, expectedValue, expectedCost, description },
      create: { name, moduleSlug, expectedValue, expectedCost, description },
    });
  }

  // --- Master plans (budgetary vision statements: group + SAEC) ---
  const planYear = new Date().getUTCFullYear();
  const masterPlanSeeds: { companyId: string | null; title: string; vision: string; targetValue: number; lines: object[] }[] = [
    {
      companyId: null,
      targetValue: 1570000_00,
      title: `Sreedhareeyam Group — Vision ${planYear}`,
      vision: "Grow the group's patient-relations business with dignified Ayurvedic care: every department plans from this vision, every centre owns its share, and follow-through is measured quarter by quarter.",
      lines: [
        { moduleSlug: "leads", yearlyValue: 200000_00, yearlyTarget: 800, kpiLabel: "New leads", quarters: { q1: 40000_00, q2: 50000_00, q3: 50000_00, q4: 60000_00 } },
        { moduleSlug: "appointments", yearlyValue: 150000_00 },
        { moduleSlug: "consultations", yearlyValue: 300000_00 },
        { moduleSlug: "camps", yearlyValue: 480000_00, yearlyTarget: 24, kpiLabel: "All camps", quarters: { q1: 90000_00, q2: 110000_00, q3: 120000_00, q4: 160000_00 } },
        { moduleSlug: "retention", yearlyValue: 120000_00 },
        { moduleSlug: "campaigns", yearlyValue: 320000_00 },
      ],
    },
    {
      companyId: saec.id,
      targetValue: 300000_00,
      title: `SAEC — Vision ${planYear}`,
      vision: "Each hospital and OP centre is a cost centre: plan your share of the network's growth in leads, outreach and retention.",
      lines: [
        { moduleSlug: "leads", yearlyValue: 80000_00, yearlyTarget: 320, kpiLabel: "New leads" },
        { moduleSlug: "camps", yearlyValue: 120000_00, yearlyTarget: 8, kpiLabel: "All camps" },
        { moduleSlug: "retention", yearlyValue: 60000_00 },
        { moduleSlug: "follow-ups", yearlyValue: 40000_00 },
      ],
    },
  ];
  for (const mp of masterPlanSeeds) {
    const exists = await prisma.masterPlan.findFirst({ where: { year: planYear, companyId: mp.companyId } });
    if (!exists) await prisma.masterPlan.create({ data: { year: planYear, ...mp } });
    else await prisma.masterPlan.update({ where: { id: exists.id }, data: { title: mp.title, vision: mp.vision, targetValue: mp.targetValue, lines: mp.lines } });
  }
  // Reverse plan on the group vision: activities expected to achieve the worth.
  const amId = async (name: string) => (await prisma.activityMaster.findUnique({ where: { name } }))?.id ?? null;
  const groupMp = await prisma.masterPlan.findFirst({ where: { year: planYear, companyId: null } });
  if (groupMp) {
    await prisma.masterPlan.update({
      where: { id: groupMp.id },
      data: {
        activities: [
          { id: "mp-act-1", activityMasterId: await amId("Eye screening camp"), moduleSlug: "camps", name: "Eye screening camp", count: 24, expectedValue: 480000_00, expectedCost: 192000_00, quarter: null },
          { id: "mp-act-2", activityMasterId: await amId("Festival lead drive"), moduleSlug: "leads", name: "Festival lead drive", count: 12, expectedValue: 120000_00, expectedCost: 30000_00, quarter: null },
          { id: "mp-act-3", activityMasterId: await amId("Reactivation call drive"), moduleSlug: "retention", name: "Reactivation call drive", count: 12, expectedValue: 72000_00, expectedCost: 12000_00, quarter: null },
          { id: "mp-act-4", activityMasterId: await amId("WhatsApp engagement blast"), moduleSlug: "communication", name: "WhatsApp engagement blast", count: 6, expectedValue: 24000_00, expectedCost: 4800_00, quarter: "Q2" },
          { id: "mp-act-5", activityMasterId: await amId("Referrer CME meet"), moduleSlug: "referrals", name: "Referrer CME meet", count: 4, expectedValue: 32000_00, expectedCost: 12000_00, quarter: null },
        ],
      },
    });
  }

  // --- A campaign ---
  await prisma.campaign.create({
    data: {
      name: "Cataract Awareness June",
      type: CampaignType.facebook_ads,
      budget: 5000000, // ₹50,000 in paise
      sourceId: websiteSrc.id,
      targetDisease: "Cataract",
    },
  }).catch(() => { /* allow re-run */ });

  // --- Representative lead (website enquiry -> lead) ---
  await prisma.lead.create({
    data: {
      contactName: "Lakshmi Nair",
      phone: "9847012345",
      whatsapp: "9847012345",
      sourceId: websiteSrc.id,
      branchId: main.id,
      preferredDoctor: "Dr. Menon",
      ownerId: callExec.id,
      stage: "new_lead",
    },
  }).catch(() => { /* allow re-run */ });

  console.log("Seed complete:", {
    branches: await prisma.branch.count(),
    departments: await prisma.department.count(),
    leadSources: await prisma.leadSourceMaster.count(),
    staff: await prisma.staffUser.count(),
    leads: await prisma.lead.count(),
    ophthalmology: ophth.id,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

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
  // Company managers (one per company — company-wide consolidation scope).
  const companyManagers: [string, string, string][] = [
    ["Devi (SAEH Company Mgr)", "saeh.manager@sreedhareeyam.test", saeh.id],
    ["Hari (SAEC Company Mgr)", "saec.manager@sreedhareeyam.test", saec.id],
  ];
  for (const [name, email, companyId] of companyManagers) {
    await prisma.staffUser.upsert({
      where: { email },
      update: { passwordHash, companyId },
      create: { name, email, role: Role.company_manager, companyId, planRank: "manager", passwordHash },
    });
  }
  const callExec = await prisma.staffUser.findUniqueOrThrow({ where: { email: "callexec@sreedhareeyam.test" } });

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

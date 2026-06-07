/**
 * Seed master data + a representative lifecycle record.
 * Idempotent: uses upserts / stable IDs where practical so it can re-run.
 * Run: npm run db:seed   (after db:up and db:migrate)
 */
import { PrismaClient, Role, ReasonCategory, FollowUpType, TaskType, CampaignType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- Branches ---
  const main = await prisma.branch.upsert({
    where: { name: "Main Hospital" },
    update: {},
    create: { name: "Main Hospital", code: "MAIN", location: "Koothattukulam" },
  });
  await prisma.branch.upsert({
    where: { name: "Kochi Branch" },
    update: {},
    create: { name: "Kochi Branch", code: "KOC", location: "Ernakulam" },
  });

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

  // --- Doctors (consultant roster) ---
  const docs: [string, string, string][] = [
    ["Dr. Menon", "Senior Consultant", "KMC-1001"],
    ["Dr. Pillai", "Consultant", "KMC-1002"],
    ["Dr. Thomas", "Medical Officer", "KMC-1003"],
  ];
  for (const [name, designation, registrationNo] of docs) {
    await prisma.doctor.upsert({ where: { registrationNo }, update: {}, create: { name, designation, registrationNo } });
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
    ["Appointment confirmation", "whatsapp", "Your appointment is confirmed. See you soon at Sreedhareeyam."],
    ["Appointment reminder", "whatsapp", "Reminder: your appointment is tomorrow."],
    ["Follow-up reminder", "sms", "It's time for your follow-up visit. Please call us to book."],
    ["Health awareness", "whatsapp", "Protect your eyes this season — tips from Sreedhareeyam."],
  ];
  for (const [name, channel, body] of templates) {
    const exists = await prisma.communicationTemplate.findFirst({ where: { name } });
    if (!exists) await prisma.communicationTemplate.create({ data: { name, channel, body } });
  }

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
  for (const [name, email, role] of staff) {
    await prisma.staffUser.upsert({
      where: { email },
      update: {},
      create: { name, email, role, branchId: main.id },
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

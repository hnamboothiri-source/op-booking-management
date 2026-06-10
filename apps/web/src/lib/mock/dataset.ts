/**
 * In-memory mock dataset for the front-end prototype (Phase 8). A small,
 * relationally-consistent object graph: base records are created first, then
 * cross-references are wired by reference (a booking carries its `.patient`,
 * a patient carries its `.bookings`, …) so the lenient mock client can ignore
 * `include` and just return embedded relations.
 *
 * The store is pinned to `globalThis` so created records survive across requests
 * (and dev Fast-Refresh module re-evaluation) for the life of the server
 * process — resets only on restart, which is fine for a prototype.
 */

type Row = Record<string, any>;

function buildStore(): { store: Record<string, Row[]>; counters: Record<string, number> } {
  const day = (offset: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
  };
  const today = day(0);

  // --- Masters ---
  // Group org structure: two legal companies, each owning a set of centres.
  const companies: Row[] = [
    { id: "co-saeh", name: "Sreedhareeyam Ayurvedic Eye Hospital and Research Centre Pvt Ltd", shortName: "Eye Hospital & Research Centre", code: "SAEH", active: true },
    { id: "co-saec", name: "Sreedhareeyam Ayurvedic Eye Clinic and Panchakarma Centre Pvt Ltd", shortName: "Eye Clinic & Panchakarma", code: "SAEC", active: true },
  ];
  // Index order is load-bearing: fixtures below reference branches[0] (flagship)
  // and branches[1] (Ernakulam — keeps the legacy "br-koc" id used by rules).
  // Module allotment per centre type. Empty = all modules (flagship).
  const OP_MODULES = ["leads", "call-center", "appointments", "consultations", "follow-ups", "patients", "communication"];
  const HOSPITAL_MODULES = [...OP_MODULES, "camps", "mobile-clinics", "admissions", "retention", "referrals", "conversion"];
  const branches: Row[] = [
    { id: "br-main", name: "Main Hospital", code: "MAIN", location: "Koothattukulam", companyId: "co-saeh", type: "flagship_hospital", enabledModules: [], active: true },
    { id: "br-koc", name: "Ernakulam Hospital", code: "EKM", location: "Ernakulam", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-knr", name: "Kannur Hospital", code: "KNR", location: "Kannur", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-blr", name: "Bangalore Hospital", code: "BLR", location: "Bangalore", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-del", name: "New Delhi Hospital", code: "DEL", location: "New Delhi", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-vsk", name: "Visakhapatnam Hospital", code: "VSK", location: "Visakhapatnam", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-mum", name: "Mumbai Hospital", code: "MUM", location: "Mumbai", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-che", name: "Chennai Hospital", code: "CHE", location: "Chennai", companyId: "co-saec", type: "hospital", enabledModules: HOSPITAL_MODULES, active: true },
    { id: "br-ktm-op", name: "Kottayam OP Centre", code: "KTM-OP", location: "Kottayam", companyId: "co-saec", type: "op_centre", enabledModules: OP_MODULES, active: true },
    { id: "br-tvm-op", name: "Trivandrum OP Centre", code: "TVM-OP", location: "Trivandrum", companyId: "co-saec", type: "op_centre", enabledModules: OP_MODULES, active: true },
  ];
  branches.forEach((b) => { b.company = companies.find((c) => c.id === b.companyId) ?? null; });
  const departments: Row[] = ["General", "Ophthalmology", "Skin & Allergy", "Orthopedic", "Gynecology"].map((name, i) => ({ id: `dep-${i}`, name, active: true }));
  // --- Real Sreedhareeyam doctor roster (chiefs first so doctors[0..2] resolve) ---
  const oph = departments[1].id; // Ophthalmology / Ayurveda OP
  // [key, full name, role, dailyTarget, opDoctor]
  const DOCTOR_DEFS: [string, string, string | null, number, boolean][] = [
    ["narayanan", "Dr Narayanan Namboothiri", "chief_physician", 12, true],
    ["sreekala", "Dr Sreekala N P", "dy_chief_physician", 6, true],
    ["sreekanth", "Dr Sreekanth P Namboothiri", "cmo", 14, true],
    ["anjalynv", "Dr Anjaly N V", "consultant", 8, true],
    ["manjusree", "Dr Manjusree R P", "consultant", 6, true],
    ["sreerag", "Dr Sreerag P Namboothiri", "consultant", 7, true],
    ["priyak", "Dr Priya K", "consultant", 4, true],
    ["subha", "Dr Subha P K", "consultant", 4, true],
    ["priyadev", "Dr Priyadev S", "consultant", 2, true],
    ["robin", "Dr Robin Roy", "consultant", 4, true],
    ["elsyitta", "Dr Elsyitta M J", "consultant", 4, true],
    ["vidhya", "Dr Vidhya Sugunan", "consultant", 4, true],
    ["nithin", "Dr Nithin C Alex", "consultant", 4, true],
    ["minu", "Dr Minu Padmini", "consultant", 4, true],
    ["lissa", "Dr Lissa Jose", "consultant", 4, true],
    ["rajesh", "Dr N S Rajesh", "consultant", 2, true],
    ["jeena", "Dr Jeena Joy", "medical_officer", 4, true],
    ["anjalyjose", "Dr Anjaly Jose", "medical_officer", 4, true],
    ["tom", "Dr Tom Augustine", "medical_officer", 4, true],
    ["aswin", "Dr Ashwin P V", "medical_officer", 2, true],
    ["geethumol", "Dr Geethumol Baby", "medical_officer", 4, true],
    ["hafis", "Dr Hafis C Hameed", "medical_officer", 4, true],
    ["sreeja", "Dr Sreeja Manohar", "medical_officer", 4, true],
    ["maheswari", "Dr Maheswari", "medical_officer", 4, true],
    ["aswathysusan", "Dr Aswathy Susan Baby", "medical_officer", 4, true],
    ["rajitha", "Dr Rajitha", "medical_officer", 2, true],
    ["aswathyts", "Dr Aswathy T S", "medical_officer", 4, true],
    ["athira", "Dr Athira Radhakrishnan", "medical_officer", 4, true],
    ["anu", "Dr Anu Jacob", "medical_officer", 4, true],
    ["aparna", "Dr Aparna K S", "medical_officer", 4, true],
    ["sreejith", "Dr Sreejith K P", "medical_officer", 2, true],
    ["subramanyan", "Dr Subramanyan Namboodiri", "medical_officer", 2, true],
    ["susan", "Dr Susan Rose", "medical_officer", 4, true],
    ["dhanya", "Dr Dhanya N Pillai", "medical_officer", 4, true],
    ["remya", "Dr Remya R", "medical_officer", 4, true],
    ["priyasam", "Dr Priya Sam", "medical_officer", 4, true],
    ["sanju", "Dr Sanju M Babu", "holistic", 0, false],
    ["neeta", "Neeta Mary George", "dietitian", 0, false],
    ["yoga", "Yoga (General)", "yoga", 0, false],
  ];
  const ROLE_LABEL: Record<string, string> = { chief_physician: "Chief Physician", dy_chief_physician: "Dy Chief Physician", cmo: "CMO", consultant: "Consultant", medical_officer: "Medical Officer", holistic: "Holistic", dietitian: "Dietitian", yoga: "Yoga" };
  // New vs follow-up % mix varies by seniority: chiefs balanced, MOs mostly new intake.
  const targetMix = (role: string | null): [number, number] =>
    role === "chief_physician" || role === "dy_chief_physician" || role === "cmo" ? [50, 50]
    : role === "consultant" ? [65, 35]
    : role === "medical_officer" ? [80, 20] : [70, 30];
  const doctors: Row[] = DOCTOR_DEFS.map(([key, name, role, dailyTarget, opDoctor], i) => {
    const [newTargetPct, followupTargetPct] = targetMix(role);
    return { id: `doc-${key}`, name, role, designation: role ? ROLE_LABEL[role] : null, opDoctor, dailyTarget, newTargetPct, followupTargetPct, registrationNo: `KMC-${2001 + i}`, active: true };
  });
  const docId = (key: string) => `doc-${key}`;

  // --- Rooms (consultation rooms first; then chief/purpose rooms) ---
  const CONSULT_ROOM_NS = [8, 9, 10, 11, 12, 13, 16, 17, 18, 19];
  const consultationRooms: Row[] = [
    ...CONSULT_ROOM_NS.map((n) => ({ id: `room-${n}`, name: `Room ${n}`, code: `Room ${n}`, purpose: "consultation", fixedDoctorId: null, departmentId: oph, branchId: branches[0].id, active: true })),
    { id: "room-7", name: "Room 7", code: "Room 7", purpose: "consultation", fixedDoctorId: docId("narayanan"), departmentId: oph, branchId: branches[0].id, active: true },
    { id: "room-6", name: "Room 6", code: "Room 6", purpose: "consultation", fixedDoctorId: docId("sreekala"), departmentId: oph, branchId: branches[0].id, active: true },
    { id: "room-5", name: "Room 5", code: "Room 5", purpose: "consultation", fixedDoctorId: docId("sreekanth"), departmentId: oph, branchId: branches[0].id, active: true },
    ...[1, 2, 3, 4].map((n) => ({ id: `room-${n}`, name: `Room ${n}`, code: `Room ${n}`, purpose: "initial_assessment", fixedDoctorId: null, departmentId: oph, branchId: branches[0].id, active: true })),
    { id: "room-14", name: "Room 14", code: "Room 14", purpose: "procedure", fixedDoctorId: null, departmentId: oph, branchId: branches[0].id, active: true },
    { id: "room-15", name: "Room 15", code: "Room 15", purpose: "jalooka", fixedDoctorId: null, departmentId: oph, branchId: branches[0].id, active: true },
  ];
  const roomId = (n: number) => `room-${n}`;
  const sourceGroups: Record<string, string> = { social_media: "digital", google_ads: "digital", website: "digital", phone: "branch", whatsapp: "digital", email: "digital", doctor_referral: "referral", patient_referral: "referral", camp: "camp", walk_in: "walk_in" };
  const leadSources: Row[] = ["social_media", "google_ads", "website", "phone", "whatsapp", "email", "doctor_referral", "patient_referral", "camp", "walk_in"].map((name, i) => ({ id: `src-${i}`, name, group: sourceGroups[name] ?? "digital", active: true }));
  const diseases: Row[] = ["Cataract", "Glaucoma", "Dry eye", "Allergic conjunctivitis", "Diabetic retinopathy"].map((name, i) => ({ id: `dis-${i}`, name, active: true }));
  const services: Row[] = [{ id: "svc-0", name: "OP Consultation", price: 30000, active: true }];
  const referralSources: Row[] = [{ id: "rs-0", name: "Existing patient", active: true }];
  const admissionPackages: Row[] = [
    { id: "pkg-0", name: "Panchakarma 7-day", estimatedCost: 2500000, active: true },
    { id: "pkg-1", name: "Netra Tarpana course", estimatedCost: 1500000, active: true },
    { id: "pkg-2", name: "Surgery + recovery", estimatedCost: 5000000, active: true },
  ];
  const followUpTypes: Row[] = [["Consultation review", "consultation_review"], ["Medicine follow-up", "medicine"], ["Test follow-up", "test"], ["Admission follow-up", "admission"], ["Annual checkup", "annual_checkup"]].map(([name, type], i) => ({ id: `fut-${i}`, name, type, active: true }));
  const taskTypes: Row[] = [["Call back patient", "call_back_patient"], ["Confirm appointment", "confirm_appointment"], ["Follow up admission", "follow_up_admission"], ["Contact dormant patient", "contact_dormant_patient"]].map(([name, type], i) => ({ id: `tt-${i}`, name, type, active: true }));
  const reasons: Row[] = [["lost_lead", "Not interested"], ["lost_lead", "Chose another hospital"], ["no_show", "Forgot appointment"], ["admission_rejection", "Cost concern"], ["cancellation", "Patient rescheduled"], ["cancellation", "Doctor unavailable"], ["cancellation", "Chose another hospital"], ["cancellation", "Cost concern"], ["cancellation", "Duplicate booking"], ["reschedule", "Patient request"], ["reschedule", "Doctor unavailable"], ["reschedule", "Branch issue"], ["reschedule", "Emergency"]].map(([category, label], i) => ({ id: `rsn-${i}`, category, label, active: true }));
  const communicationTemplates: Row[] = [
    { id: "tpl-0", name: "Appointment confirmation", channel: "whatsapp", body: "Hi {{name}}, your appointment is confirmed.", active: true },
    { id: "tpl-1", name: "Follow-up reminder", channel: "sms", body: "Hi {{first_name}}, it's time for your follow-up.", active: true },
    { id: "tpl-med", name: "medicine_reminder", channel: "whatsapp", body: "Hi {{first_name}}, a reminder to continue {{medicine}}. Please order a refill if you are running low.", active: true },
    { id: "tpl-thr", name: "therapy_reminder", channel: "whatsapp", body: "Hi {{first_name}}, your therapy session is scheduled. Please arrive 15 minutes early.", active: true },
  ];

  // --- Designations (per-company catalogues; group-level rows have companyId null) ---
  // roleTemplate = RBAC base; planRank = approval tier; moduleSlugs empty = role default;
  // pageAccess { [moduleSlug]: hrefs } limits pages within a module (empty/missing = all).
  const designations: Row[] = [
    { id: "des-group-head", name: "Group Head / Directors", companyId: null, level: 1, roleTemplate: "management", planRank: "manager", moduleSlugs: [], pageAccess: null, reportsToDesignationId: null, approverDesignationId: null, active: true },
    // SAEC — full set
    { id: "des-saec-ceo", name: "Executive Director / CEO", companyId: "co-saec", level: 2, roleTemplate: "company_manager", planRank: "manager", moduleSlugs: [], pageAccess: null, tools: ["master-plan", "group", "analytics", "reports"], reportsToDesignationId: "des-group-head", approverDesignationId: null, active: true },
    { id: "des-saec-prdh", name: "Patient Relations Dept Head", companyId: "co-saec", level: 3, roleTemplate: "patient_success_executive", planRank: "manager", moduleSlugs: [], pageAccess: null, tools: ["master-plan", "reports"], reportsToDesignationId: "des-saec-ceo", approverDesignationId: null, active: true },
    { id: "des-saec-smpr", name: "Senior Manager – Public Relations", companyId: "co-saec", level: 4, roleTemplate: "marketing_team", planRank: "manager", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saec-prdh", approverDesignationId: null, active: true },
    { id: "des-saec-mpr", name: "Manager – Patient Relations", companyId: "co-saec", level: 5, roleTemplate: "patient_success_executive", planRank: "supervisor", moduleSlugs: [], pageAccess: null, moduleRanks: { communication: "read_only" }, reportsToDesignationId: "des-saec-prdh", approverDesignationId: "des-saec-prdh", active: true },
    { id: "des-saec-mcc", name: "Manager – Call Center", companyId: "co-saec", level: 5, roleTemplate: "call_center_manager", planRank: "supervisor", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saec-prdh", approverDesignationId: null, active: true },
    { id: "des-saec-ampr", name: "Asst Manager – Public Relations", companyId: "co-saec", level: 6, roleTemplate: "marketing_team", planRank: "supervisor", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saec-smpr", approverDesignationId: null, active: true },
    { id: "des-saec-pro", name: "Patient Relations Officer", companyId: "co-saec", level: 6, roleTemplate: "patient_success_executive", planRank: "staff", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saec-mpr", approverDesignationId: null, active: true },
    { id: "des-saec-pre", name: "Patient Relations Executive", companyId: "co-saec", level: 7, roleTemplate: "patient_success_executive", planRank: "staff", moduleSlugs: ["follow-ups", "retention", "communication", "patients"], pageAccess: { retention: ["/retention/worklist", "/modules/retention/reports"] }, activityTypes: { "follow-ups": ["followup_drive"], retention: ["reactivation_drive"] }, reportsToDesignationId: "des-saec-pro", approverDesignationId: "des-saec-mpr", active: true },
    { id: "des-saec-pue", name: "Public Relations Executive", companyId: "co-saec", level: 7, roleTemplate: "marketing_team", planRank: "staff", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saec-ampr", approverDesignationId: null, active: true },
    // SAEH — trimmed starter set (admin adds more from /designations)
    { id: "des-saeh-ceo", name: "Executive Director / CEO", companyId: "co-saeh", level: 2, roleTemplate: "company_manager", planRank: "manager", moduleSlugs: [], pageAccess: null, tools: ["master-plan", "group", "analytics", "reports"], reportsToDesignationId: "des-group-head", approverDesignationId: null, active: true },
    { id: "des-saeh-prdh", name: "Patient Relations Dept Head", companyId: "co-saeh", level: 3, roleTemplate: "patient_success_executive", planRank: "manager", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saeh-ceo", approverDesignationId: null, active: true },
    { id: "des-saeh-mcc", name: "Manager – Call Center", companyId: "co-saeh", level: 5, roleTemplate: "call_center_manager", planRank: "supervisor", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saeh-prdh", approverDesignationId: null, active: true },
    { id: "des-saeh-pro", name: "Patient Relations Officer", companyId: "co-saeh", level: 6, roleTemplate: "patient_success_executive", planRank: "staff", moduleSlugs: [], pageAccess: null, reportsToDesignationId: "des-saeh-mcc", approverDesignationId: null, active: true },
  ];

  // --- Staff ---
  const staffUsers: Row[] = [
    { id: "stf-admin", name: "Admin User", email: "admin@sreedhareeyam.test", role: "administrator", branchId: branches[0].id, companyId: "co-saeh", active: true, managedModules: [], planRank: "manager" },
    { id: "stf-callexec", name: "Call Exec", email: "callexec@sreedhareeyam.test", role: "call_center_executive", branchId: branches[0].id, companyId: "co-saeh", active: true, managedModules: [], planRank: "staff" },
    { id: "stf-front", name: "Front Desk", email: "front@sreedhareeyam.test", role: "front_office", branchId: branches[0].id, companyId: "co-saeh", active: true, managedModules: [], planRank: "staff" },
    { id: "stf-menon", name: "Dr. Menon", email: "menon@sreedhareeyam.test", role: "doctor", branchId: branches[0].id, companyId: "co-saeh", active: true, managedModules: [], planRank: "staff" },
    { id: "stf-superv", name: "Suma (Supervisor)", email: "supervisor@sreedhareeyam.test", role: "call_center_manager", branchId: branches[0].id, companyId: "co-saeh", designationId: "des-saeh-mcc", active: true, managedModules: [], planRank: "supervisor" },
    // Department managers (Module Workspaces): confined to the modules they own.
    { id: "stf-clinmgr", name: "Dr. Priya (Clinical Mgr)", email: "clinical.manager@sreedhareeyam.test", role: "module_manager", branchId: branches[0].id, companyId: "co-saeh", active: true, managedModules: ["consultations", "follow-ups", "conversion"], planRank: "manager" },
    { id: "stf-outmgr", name: "Rahul (Outreach Mgr)", email: "outreach.manager@sreedhareeyam.test", role: "module_manager", branchId: branches[0].id, companyId: "co-saeh", active: true, managedModules: ["camps", "mobile-clinics"], planRank: "manager" },
    // Org-scope logins: company managers (whole company) and a centre-pinned branch manager.
    { id: "stf-saehmgr", name: "Devi (SAEH Company Mgr)", email: "saeh.manager@sreedhareeyam.test", role: "company_manager", branchId: null, companyId: "co-saeh", designationId: "des-saeh-ceo", active: true, managedModules: [], planRank: "manager" },
    { id: "stf-saecmgr", name: "Hari (SAEC Company Mgr)", email: "saec.manager@sreedhareeyam.test", role: "company_manager", branchId: null, companyId: "co-saec", designationId: "des-saec-ceo", active: true, managedModules: [], planRank: "manager" },
    { id: "stf-chembr", name: "Lakshmi (Chennai Centre Mgr)", email: "chennai.manager@sreedhareeyam.test", role: "branch_manager", branchId: "br-che", companyId: "co-saec", active: true, managedModules: [], planRank: "supervisor" },
    // Designation-hierarchy demo staff (maker → checker → approver chain in SAEC patient relations).
    { id: "stf-grouphead", name: "Adv. Mohan (Group Director)", email: "group.director@sreedhareeyam.test", role: "management", branchId: null, companyId: null, designationId: "des-group-head", active: true, managedModules: [], planRank: "manager" },
    { id: "stf-prhead", name: "Dr. Kavitha (PR Dept Head)", email: "pr.head@sreedhareeyam.test", role: "patient_success_executive", branchId: null, companyId: "co-saec", designationId: "des-saec-prdh", active: true, managedModules: [], planRank: "staff" },
    { id: "stf-prmgr", name: "Anitha (Mgr – Patient Relations)", email: "pr.manager@sreedhareeyam.test", role: "patient_success_executive", branchId: "br-koc", companyId: "co-saec", designationId: "des-saec-mpr", active: true, managedModules: [], planRank: "staff" },
    { id: "stf-prexec", name: "Vimal (Patient Relations Exec)", email: "pr.exec@sreedhareeyam.test", role: "patient_success_executive", branchId: "br-koc", companyId: "co-saec", designationId: "des-saec-pre", active: true, managedModules: [], planRank: "staff" },
  ];

  // --- Patients ---
  const patients: Row[] = [
    { mrd: "MRD-1001", name: "Lakshmi Nair", phone: "9847012345", whatsapp: "9847012345", place: "Kochi", category: "repeat_patient", lifetimeVisits: 4, lifetimeRevenue: 480000, isNew: false, consentWhatsapp: true, consentSms: true, consentEmail: false, lastVisitDate: day(-20), createdAt: day(-200), updatedAt: day(-20) },
    { mrd: "MRD-1002", name: "Suresh Menon", phone: "9847022345", place: "Thrissur", category: "high_value", lifetimeVisits: 7, lifetimeRevenue: 1250000, isNew: false, consentWhatsapp: true, consentSms: false, consentEmail: false, lastVisitDate: day(-5), createdAt: day(-365), updatedAt: day(-5) },
    { mrd: "MRD-1003", name: "Anita George", phone: "9847032345", place: "Ernakulam", category: "new_patient", lifetimeVisits: 1, lifetimeRevenue: 30000, isNew: true, consentWhatsapp: true, consentSms: true, consentEmail: true, lastVisitDate: day(-2), createdAt: day(-30), updatedAt: day(-2) },
    { mrd: "MRD-DORMANT1", name: "Ravi Kumar", phone: "9847099001", place: "Thrissur", category: "dormant", lifetimeVisits: 3, lifetimeRevenue: 360000, isNew: false, consentWhatsapp: true, consentSms: false, consentEmail: false, lastVisitDate: day(-280), createdAt: day(-400), updatedAt: day(-280) },
    { mrd: "MRD-1005", name: "Fathima Rasheed", phone: "9847052345", place: "Malappuram", category: "at_risk", lifetimeVisits: 2, lifetimeRevenue: 90000, isNew: false, consentWhatsapp: false, consentSms: true, consentEmail: false, lastVisitDate: day(-120), createdAt: day(-150), updatedAt: day(-120) },
    { mrd: "MRD-1006", name: "Thomas Varghese", phone: "9847060006", place: "Koothattukulam", category: "repeat_patient", lifetimeVisits: 3, lifetimeRevenue: 210000, isNew: false, consentWhatsapp: true, consentSms: true, consentEmail: false, lastVisitDate: day(-90), createdAt: day(-300), updatedAt: day(-90) },
    { mrd: "MRD-1007", name: "Saramma Joseph", phone: "9847060007", place: "Koothattukulam", category: "dormant", lifetimeVisits: 2, lifetimeRevenue: 120000, isNew: false, consentWhatsapp: true, consentSms: false, consentEmail: false, lastVisitDate: day(-240), createdAt: day(-360), updatedAt: day(-240) },
  ];

  // --- Leads ---
  const leads: Row[] = [
    { id: "lead-1", leadNumber: "LEAD-2026-000001", contactName: "Lakshmi Nair", phone: "9847012345", whatsapp: "9847012345", gender: "female", age: 58, city: "Kochi", district: "Ernakulam", chiefComplaint: "Blurred vision, cataract suspected", diseaseId: diseases[0].id, previousTreatment: false, existingPatient: false, stage: "new_lead", sourceId: leadSources[2].id, secondarySource: "website", priorityTier: "hot", ownerId: staffUsers[1].id, assignedAt: day(-3), branchId: branches[0].id, preferredDoctor: "Dr. Menon", followUpDate: day(-2), mergedIntoId: null, patientMrd: null, campaignId: "camp-1", responseChannel: "whatsapp", desk: "back_office", createdAt: day(-3) },
    { id: "lead-2", leadNumber: "LEAD-2026-000002", contactName: "Joseph Mathew", phone: "9847062345", gender: "male", age: 45, city: "Thrissur", district: "Thrissur", chiefComplaint: "Dry eyes, irritation", diseaseId: diseases[2].id, previousTreatment: true, existingPatient: false, stage: "contacted", sourceId: leadSources[1].id, secondarySource: "google_ads", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(-6), branchId: branches[0].id, followUpDate: day(1), lastContactAt: day(-1), mergedIntoId: null, desk: "back_office", createdAt: day(-6) },
    { id: "lead-3", leadNumber: "LEAD-2026-000003", contactName: "Meera Das", phone: "9847072345", gender: "female", age: 62, city: "Kottayam", district: "Kottayam", chiefComplaint: "Glaucoma follow-up enquiry", diseaseId: diseases[1].id, previousTreatment: true, existingPatient: false, stage: "interested", sourceId: leadSources[0].id, secondarySource: "facebook", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(-8), branchId: branches[0].id, followUpDate: day(-1), lastContactAt: day(-2), mergedIntoId: null, desk: "back_office", createdAt: day(-8) },
    { id: "lead-4", leadNumber: "LEAD-2026-000004", contactName: "Anita George", phone: "9847032345", gender: "female", age: 50, city: "Kochi", district: "Ernakulam", chiefComplaint: "Cataract surgery enquiry", diseaseId: diseases[0].id, previousTreatment: false, existingPatient: true, stage: "appointment_booked", sourceId: leadSources[2].id, ownerId: staffUsers[1].id, assignedAt: day(-30), branchId: branches[0].id, patientMrd: "MRD-1003", lastContactAt: day(-28), mergedIntoId: null, desk: "back_office", createdAt: day(-30) },
    { id: "lead-5", leadNumber: "LEAD-2026-000005", contactName: "Vinod P", phone: "9847082345", gender: "male", age: 39, city: "Aluva", district: "Ernakulam", chiefComplaint: "General eye checkup", previousTreatment: false, existingPatient: false, stage: "not_reachable", sourceId: leadSources[3].id, priorityTier: "cold", ownerId: staffUsers[1].id, assignedAt: day(-10), branchId: branches[0].id, followUpDate: day(-4), lastContactAt: day(-7), mergedIntoId: null, desk: "reception", createdAt: day(-10) },
    { id: "lead-6", leadNumber: "LEAD-2026-000006", contactName: "Ann Mathai", phone: "9847060001", gender: "female", age: 47, city: "Perumbavoor", district: "Ernakulam", chiefComplaint: "Watering eyes", stage: "new_lead", sourceId: leadSources[3].id, priorityTier: "hot", ownerId: null, branchId: branches[0].id, mergedIntoId: null, desk: "reception", createdAt: day(0) },
    { id: "lead-7", leadNumber: "LEAD-2026-000007", contactName: "Bilal K", phone: "9847060002", whatsapp: "9847060002", gender: "male", age: 33, city: "Calicut", district: "Kozhikode", chiefComplaint: "Diabetic retinopathy screening", diseaseId: diseases[4].id, stage: "new_lead", sourceId: leadSources[4].id, secondarySource: "whatsapp", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(0), branchId: branches[0].id, mergedIntoId: null, desk: "back_office", createdAt: day(0) },
    { id: "lead-8", leadNumber: "LEAD-2026-000008", contactName: "Ramesh Kurup", phone: "9847060008", gender: "male", age: 61, city: "Kochi", district: "Ernakulam", chiefComplaint: "Cataract — saw the reel", diseaseId: diseases[0].id, stage: "new_lead", sourceId: leadSources[1].id, secondarySource: "google_ads", priorityTier: "hot", ownerId: staffUsers[1].id, assignedAt: day(-3), branchId: branches[0].id, mergedIntoId: null, campaignId: "camp-1", responseChannel: "call", desk: "back_office", createdAt: day(-3) },
    { id: "lead-9", leadNumber: "LEAD-2026-000009", contactName: "Sania P", phone: "9847060009", gender: "female", age: 52, city: "Kochi", district: "Ernakulam", chiefComplaint: "Cataract enquiry from Insta", diseaseId: diseases[0].id, stage: "contacted", sourceId: leadSources[2].id, secondarySource: "instagram", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(-3), branchId: branches[0].id, mergedIntoId: null, campaignId: "camp-1", responseChannel: "email", lastContactAt: day(-2), desk: "back_office", createdAt: day(-3) },
  ];

  // --- Bookings ---
  const bookings: Row[] = [
    { id: "bk-1", bookingRef: "OP-0001", patientMrd: "MRD-1003", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, roomId: consultationRooms[0].id, appointmentDate: today, startTime: "10:30", status: "arrived", source: "online", appointmentType: "regular", queueToken: 1, checkedInAt: day(0), bookedAt: day(-1), bookedBy: "stf-callexec", leadId: "lead-4" },
    { id: "bk-2", bookingRef: "OP-0002", patientMrd: "MRD-1001", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, appointmentDate: today, startTime: "11:00", status: "waiting", source: "front_desk", appointmentType: "regular", queueToken: 2, checkedInAt: day(0), bookedAt: today, bookedBy: "stf-front" },
    { id: "bk-3", bookingRef: "OP-0003", patientMrd: "MRD-1002", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[0].id, appointmentDate: day(-5), startTime: "09:30", status: "completed", source: "call_centre", appointmentType: "regular", bookedAt: day(-6), bookedBy: "stf-callexec", completedAt: day(-5) },
    { id: "bk-4", bookingRef: "OP-0004", patientMrd: "MRD-1005", doctorId: doctors[2].id, departmentId: departments[0].id, branchId: branches[0].id, appointmentDate: day(1), startTime: "12:00", status: "booked", source: "follow_up", appointmentType: "follow_up", bookedAt: day(-1), bookedBy: "stf-callexec" },
    { id: "bk-5", bookingRef: "OP-0005", patientMrd: "MRD-1002", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, appointmentDate: day(-40), startTime: "10:00", status: "no_show", source: "call_centre", appointmentType: "regular", bookedAt: day(-42), bookedBy: "stf-callexec", cancellationReason: "Forgot appointment" },
  ];

  // --- Real weekly room/doctor/session grid (Sheet 2) → DoctorSchedule rows ---
  // Tuple: [docKey, dayOfWeek(0=Sun..6=Sat), session('m'|'a'|'full'), roomN, slotsCount, weekOfMonth|null, startOverride?, endOverride?]
  const MORN = ["09:00", "12:30"], AFTN = ["14:00", "18:00"], FULL = ["09:30", "16:00"];
  type SD = [string, number, "m" | "a" | "full", number, number, string | null, string?, string?];
  const SCHEDULE_DEFS: SD[] = [
    // Chiefs (Sheet 1)
    ["narayanan", 1, "full", 7, 6, null, "09:00", "13:00"], ["narayanan", 3, "full", 7, 6, null, "09:00", "13:00"], ["narayanan", 5, "full", 7, 6, null, "09:00", "13:00"],
    ["sreekala", 3, "full", 6, 3, null, "09:00", "17:00"], ["sreekala", 6, "full", 6, 3, null, "09:00", "17:00"],
    ["sreekanth", 4, "full", 5, 7, null, "09:30", "13:00"], ["sreekanth", 6, "full", 5, 7, null, "09:30", "13:00"],
    // Room 8
    ["sreerag", 1, "full", 8, 3, null, "09:30", "15:00"], ["sreerag", 2, "full", 8, 3, null, "09:30", "15:00"], ["sreerag", 0, "m", 8, 4, null, "09:00", "13:00"],
    ["minu", 3, "full", 8, 2, null], ["minu", 5, "full", 8, 2, null], ["elsyitta", 4, "full", 8, 2, null], ["elsyitta", 6, "full", 8, 2, null],
    // Room 9 (AM/PM)
    ["geethumol", 1, "m", 9, 2, null], ["hafis", 1, "a", 9, 2, null],
    ["anjalyjose", 2, "m", 9, 2, null], ["aswathysusan", 2, "a", 9, 2, null],
    ["hafis", 3, "m", 9, 2, null], ["anjalyjose", 3, "a", 9, 2, null],
    ["aswathyts", 4, "m", 9, 2, null], ["tom", 4, "a", 9, 2, null],
    ["tom", 5, "m", 9, 2, null], ["geethumol", 5, "a", 9, 2, null],
    ["aswathysusan", 6, "m", 9, 2, null], ["aswathyts", 6, "a", 9, 2, null],
    ["tom", 0, "m", 9, 2, "1"], ["anjalyjose", 0, "m", 9, 2, "2,5"], ["hafis", 0, "m", 9, 2, "3"], ["geethumol", 0, "m", 9, 2, "4"],
    // Room 10
    ["vidhya", 1, "full", 10, 2, null], ["subha", 2, "full", 10, 2, null], ["rajitha", 3, "full", 10, 2, null, "09:00", "16:30"],
    ["athira", 4, "m", 10, 2, null], ["aparna", 4, "a", 10, 2, null], ["subha", 5, "full", 10, 2, null], ["vidhya", 6, "full", 10, 2, null],
    ["vidhya", 0, "m", 10, 2, "1"], ["aswathysusan", 0, "m", 10, 2, "2"], ["rajitha", 0, "m", 10, 2, "3"], ["subha", 0, "m", 10, 2, "4"],
    // Room 11
    ["subramanyan", 1, "m", 11, 2, null, "09:00", "12:30"], ["susan", 1, "a", 11, 2, null],
    ["dhanya", 2, "m", 11, 2, null], ["remya", 2, "a", 11, 2, null, "14:00", "17:00"],
    ["subramanyan", 3, "m", 11, 2, null], ["remya", 3, "a", 11, 2, null],
    ["remya", 4, "m", 11, 2, null], ["dhanya", 4, "a", 11, 2, null, "14:00", "17:00"],
    ["subramanyan", 5, "m", 11, 2, null], ["dhanya", 5, "a", 11, 2, null],
    ["rajesh", 6, "full", 11, 2, "1,3", "11:00", "15:00"],
    ["remya", 0, "m", 11, 2, "1,5"], ["aswathyts", 0, "m", 11, 2, "2"], ["dhanya", 0, "m", 11, 2, "4"],
    // Room 12
    ["maheswari", 1, "m", 12, 2, null], ["sreeja", 1, "a", 12, 2, null],
    ["priyadev", 2, "full", 12, 2, null, "09:00", "16:00"], ["jeena", 3, "a", 12, 2, null],
    ["anu", 4, "m", 12, 2, null], ["maheswari", 4, "a", 12, 2, null],
    ["sreeja", 5, "m", 12, 2, null], ["aswin", 5, "a", 12, 2, null],
    ["jeena", 6, "m", 12, 2, null], ["anu", 6, "a", 12, 2, null], ["aswin", 0, "a", 12, 2, null],
    // Room 13
    ["priyasam", 1, "m", 13, 2, null], ["susan", 1, "a", 13, 2, null],
    ["anjalynv", 2, "full", 13, 4, null, "11:00", "14:00"], ["anjalynv", 4, "full", 13, 4, null, "11:00", "14:00"],
    ["susan", 6, "full", 13, 2, null, "09:00", "17:00"],
    // Room 16
    ["sreejith", 1, "full", 16, 2, null, "09:30", "13:00"], ["sreejith", 2, "full", 16, 2, null, "09:30", "13:00"], ["sreejith", 6, "full", 16, 2, null, "09:30", "13:00"],
    ["susan", 4, "m", 16, 2, null], ["priyasam", 4, "a", 16, 2, null, "14:00", "17:00"],
    ["priyasam", 0, "m", 16, 2, "2"], ["susan", 0, "m", 16, 2, "3"],
    // Room 17 (Sun rotation only)
    ["sreeja", 0, "m", 17, 2, "1"], ["jeena", 0, "m", 17, 2, "2"], ["anu", 0, "m", 17, 2, "3"], ["maheswari", 0, "m", 17, 2, "4"],
    // Room 18
    ["manjusree", 1, "full", 18, 3, null, "09:30", "15:00"], ["manjusree", 2, "full", 18, 3, null, "09:30", "15:00"],
    ["lissa", 3, "full", 18, 2, null], ["nithin", 4, "full", 18, 2, null], ["lissa", 5, "full", 18, 2, null], ["nithin", 6, "full", 18, 2, null],
    ["minu", 0, "m", 18, 2, "1"], ["elsyitta", 0, "m", 18, 2, "2"], ["nithin", 0, "m", 18, 2, "3"],
    // Room 19
    ["priyak", 1, "full", 19, 2, null, "09:30", "15:30"], ["robin", 2, "full", 19, 2, null], ["priyak", 3, "full", 19, 2, null, "09:30", "15:30"], ["robin", 4, "full", 19, 2, null],
    ["aparna", 6, "m", 19, 2, null], ["athira", 6, "a", 19, 2, null],
    ["priyak", 0, "m", 19, 2, "1"], ["robin", 0, "m", 19, 2, "2"], ["aparna", 0, "m", 19, 2, "3"], ["athira", 0, "m", 19, 2, "4"],
  ];
  const sessWindow = (s: "m" | "a" | "full", so?: string, eo?: string): [string, string] => so && eo ? [so, eo] : s === "m" ? [MORN[0], MORN[1]] : s === "a" ? [AFTN[0], AFTN[1]] : [FULL[0], FULL[1]];
  const sessLabel = (s: "m" | "a" | "full") => (s === "m" ? "morning" : s === "a" ? "afternoon" : "full");
  const doctorSchedules: Row[] = SCHEDULE_DEFS.map((d, i) => {
    const [key, dow, sess, rN, slots, wom, so, eo] = d;
    const [st, en] = sessWindow(sess, so, eo);
    return { id: `sch-${i}`, doctorId: docId(key), departmentId: oph, branchId: branches[0].id, dayOfWeek: dow, specificDate: null, session: sessLabel(sess), roomId: roomId(rN), slotsCount: slots, weekOfMonth: wom, startTime: st, endTime: en, slotDurationMinutes: Math.max(10, Math.floor(((parseInt(en) * 60) - (parseInt(st) * 60)) / Math.max(1, slots))), maxPatientsPerSlot: 1, active: true };
  });

  // Generate today's slots from the schedules on today's weekday (split each session into `slotsCount`).
  const todayDow = today.getUTCDay();
  const onLeaveToday = new Set(["lissa"]); // Dr Lissa Jose is on leave
  const splitSlots = (start: string, end: string, count: number) => {
    const m = (t: string) => { const [h, mm] = t.split(":").map(Number); return h * 60 + mm; };
    const str = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    const s = m(start), e = m(end), n = Math.max(1, count); if (e <= s) return [[start, end]] as [string, string][];
    const step = Math.floor((e - s) / n);
    return Array.from({ length: n }, (_, i) => [str(s + i * step), str(i === n - 1 ? e : s + (i + 1) * step)] as [string, string]);
  };
  const timeSlots: Row[] = [];
  let tsN = 0;
  for (const sch of doctorSchedules) {
    if (sch.dayOfWeek !== todayDow) continue;
    if (sch.weekOfMonth) continue; // rotation tags not generated (shown only)
    const docKey = (sch.doctorId as string).replace("doc-", "");
    const blocked = onLeaveToday.has(docKey);
    for (const [st, en] of splitSlots(sch.startTime, sch.endTime, sch.slotsCount ?? 1)) {
      timeSlots.push({ id: `ts-${tsN++}`, doctorId: sch.doctorId, departmentId: oph, branchId: branches[0].id, scheduleId: sch.id, roomId: sch.roomId, slotDate: today, startTime: st, endTime: en, capacity: 1, bookedCount: 0, status: blocked ? "blocked" : "open" });
    }
  }

  // Book a few patients into today's open slots so the agenda/calendar show real consultations.
  const demoPatients = ["MRD-1001", "MRD-1002", "MRD-1003", "MRD-1005", "MRD-DORMANT1"];
  const bookableToday = timeSlots.filter((s) => s.status === "open").slice(0, 6);
  bookableToday.forEach((slot, i) => {
    slot.bookedCount = 1;
    slot.status = "full";
    const opStatus = i === 0 ? "completed" : i === 1 ? "in_consultation" : i === 2 ? "arrived" : i < 4 ? "confirmed" : "booked";
    // Mix new vs follow-up; mark a couple as call-centre conversions (asked for another doctor) and one no-preference.
    const apptType = i % 3 === 0 ? "follow_up" : "regular";
    const requestedDoctorId = i === 2 ? doctors[0].id : i === 4 ? doctors[1].id : null; // asked for a different (busy) doctor
    const noPreference = i === 1;
    bookings.push({
      id: `bk-slot-${i}`, bookingRef: `OP-1${String(i).padStart(3, "0")}`, patientMrd: demoPatients[i % demoPatients.length],
      doctorId: slot.doctorId, departmentId: oph, branchId: branches[0].id, roomId: slot.roomId, timeSlotId: slot.id,
      appointmentDate: today, startTime: slot.startTime, endTime: slot.endTime, status: opStatus, source: "call_centre",
      appointmentType: apptType, requestedDoctorId, noPreference, queueToken: 10 + i, bookedBy: "stf-callexec", bookedAt: day(-1),
      checkedInAt: ["arrived", "in_consultation", "completed"].includes(opStatus) ? day(0) : null,
      completedAt: opStatus === "completed" ? day(0) : null,
    });
  });

  const appointmentStatusHistory: Row[] = [
    { id: "ash-1", bookingId: "bk-1", fromStatus: "booked", toStatus: "confirmed", actorId: "stf-callexec", createdAt: day(-1) },
    { id: "ash-2", bookingId: "bk-1", fromStatus: "confirmed", toStatus: "arrived", actorId: "stf-front", createdAt: day(0) },
    { id: "ash-3", bookingId: "bk-3", fromStatus: "in_consultation", toStatus: "completed", actorId: "stf-menon", createdAt: day(-5) },
  ];
  const appointmentReminders: Row[] = [
    { id: "rem-1", bookingId: "bk-4", kind: "booking", channel: "whatsapp", scheduledFor: day(-1), sentAt: day(-1), status: "sent" },
  ];
  const doctorLeaves: Row[] = [
    { id: "dl-1", doctorId: docId("lissa"), branchId: branches[0].id, fromDate: day(-7), toDate: day(21), kind: "leave", reason: "On leave", createdAt: day(-8) },
  ];

  // --- Consultations ---
  const consultations: Row[] = [
    { id: "cons-1", bookingId: "bk-3", patientMrd: "MRD-1002", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[0].id, diseaseId: diseases[0].id, fee: 8000_00, outcome: "admission_advised", diagnosis: "Bilateral cataract", advice: "Surgery recommended", notes: "Discuss package", staffRemarks: "Counsel on surgery package; patient anxious about cost", createdAt: day(-5) },
    { id: "cons-2", bookingId: "bk-101", patientMrd: "MRD-1003", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, diseaseId: diseases[1].id, outcome: "test_recommended", diagnosis: "Suspected glaucoma", advice: "Confirm with tests", staffRemarks: "Call to confirm she completed tonometry before review", createdAt: day(-3) },
    { id: "cons-3", bookingId: "bk-102", patientMrd: "MRD-1001", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, diseaseId: diseases[2].id, outcome: "medicine_prescribed", diagnosis: "Dry eye", advice: "Start lubricants + Panchakarma", createdAt: day(-2) },
    { id: "cons-4", bookingId: "bk-103", patientMrd: "MRD-1005", doctorId: doctors[2].id, departmentId: departments[0].id, branchId: branches[0].id, diseaseId: diseases[4].id, outcome: "test_recommended", diagnosis: "Diabetic retinopathy screen", advice: "Blood panel before review", createdAt: day(-8) },
    { id: "cons-5", bookingId: "bk-104", patientMrd: "MRD-DORMANT1", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[0].id, diseaseId: diseases[3].id, fee: 6000_00, outcome: "referred_to_department", diagnosis: "Allergic conjunctivitis + retinal note", advice: "Refer to Retina dept", referredDepartmentId: departments[1].id, referredDoctorId: doctors[0].id, staffRemarks: "Help patient book the retina referral", createdAt: day(-20) },
    { id: "cons-6", bookingId: "bk-105", patientMrd: "MRD-1002", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[0].id, diseaseId: diseases[0].id, fee: 5000_00, outcome: "surgery_or_procedure_advised", diagnosis: "Mature cataract (L)", advice: "Pre-op workup", createdAt: day(-12) },
    { id: "cons-7", bookingId: "bk-106", patientMrd: "MRD-1003", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, diseaseId: diseases[2].id, outcome: "medicine_prescribed", diagnosis: "Dry eye", advice: "Internal medication course", createdAt: day(-1) },
  ];

  // --- Lab/test referrals (Consultation → Test) ---
  const labReferrals: Row[] = [
    { id: "lab-1", consultationId: "cons-2", testName: "Fundus photography", status: "done", createdAt: day(-3) },
    { id: "lab-2", consultationId: "cons-2", testName: "Applanation tonometry", status: "done", createdAt: day(-3) },
    { id: "lab-3", consultationId: "cons-4", testName: "FBS / PPBS", status: "pending", createdAt: day(-8) },
    { id: "lab-4", consultationId: "cons-4", testName: "HbA1c", status: "booked", createdAt: day(-8) },
    { id: "lab-5", consultationId: "cons-6", testName: "Pre-op ECG", status: "missed", createdAt: day(-12) },
  ];

  // --- Treatment plans (Test/Consultation → Treatment) ---
  const treatmentPlans: Row[] = [
    { id: "tp-1", consultationId: "cons-3", summary: "Panchakarma 14-day course", durationDays: 14, status: "in_progress", startedAt: day(-2), completedAt: null, createdAt: day(-2) },
    { id: "tp-2", consultationId: "cons-1", summary: "Netra Tarpana course", durationDays: 7, status: "completed", startedAt: day(-5), completedAt: day(-1), createdAt: day(-5) },
    { id: "tp-3", consultationId: "cons-6", summary: "Surgery prep + recovery protocol", durationDays: 21, status: "planned", startedAt: null, completedAt: null, createdAt: day(-12) },
    { id: "tp-4", consultationId: "cons-7", summary: "Internal medication course", durationDays: 30, status: "in_progress", startedAt: day(-1), completedAt: null, createdAt: day(-1) },
  ];

  // --- Admissions ---
  const admissions: Row[] = [
    { id: "adm-1", patientMrd: "MRD-1002", consultationId: "cons-1", doctorId: doctors[1].id, packageId: admissionPackages[2].id, estimatedCost: 5000000, status: "counselled", createdAt: day(-5), updatedAt: day(-4) },
    { id: "adm-2", patientMrd: "MRD-1001", doctorId: doctors[0].id, packageId: admissionPackages[0].id, estimatedCost: 2500000, status: "admitted", createdAt: day(-25), updatedAt: day(-20) },
    { id: "adm-3", patientMrd: "MRD-1005", consultationId: "cons-6", doctorId: doctors[1].id, packageId: admissionPackages[1].id, estimatedCost: 1500000, status: "recommended", createdAt: day(-12), updatedAt: day(-12) },
    { id: "adm-4", patientMrd: "MRD-1003", consultationId: "cons-2", doctorId: doctors[0].id, packageId: admissionPackages[0].id, estimatedCost: 2500000, status: "interested", createdAt: day(-4), updatedAt: day(-3) },
    { id: "adm-5", patientMrd: "MRD-DORMANT1", doctorId: doctors[1].id, packageId: admissionPackages[2].id, estimatedCost: 5000000, status: "rejected", rejectionReason: "cost_concern", createdAt: day(-18), updatedAt: day(-15) },
  ];

  // --- Follow-ups ---
  const followUps: Row[] = [
    { id: "fu-1", patientMrd: "MRD-1002", type: "admission", dueDate: day(-1), status: "pending", doctorId: doctors[1].id, ownerId: staffUsers[1].id, consultationId: "cons-1", desk: "front_office", createdAt: day(-5) },
    { id: "fu-2", patientMrd: "MRD-1003", type: "consultation_review", dueDate: today, status: "pending", ownerId: staffUsers[1].id, desk: "front_office", createdAt: day(-2) },
    { id: "fu-3", patientMrd: "MRD-1001", type: "medicine", dueDate: day(5), status: "booked", ownerId: staffUsers[1].id, desk: "front_office", createdAt: day(-2) },
    { id: "fu-4", patientMrd: "MRD-DORMANT1", type: "dormant_reactivation", dueDate: day(-10), status: "missed", ownerId: staffUsers[1].id, desk: "front_office", createdAt: day(-15) },
    // Closed follow-ups give the compliance report on-time vs late vs missed signal.
    { id: "fu-5", patientMrd: "MRD-1001", type: "medicine", dueDate: day(-3), status: "done", completedAt: day(-3), ownerId: staffUsers[1].id, consultationId: "cons-3", desk: "front_office", createdAt: day(-6) },
    { id: "fu-6", patientMrd: "MRD-1003", type: "consultation_review", dueDate: day(-7), status: "done", completedAt: day(-5), ownerId: staffUsers[1].id, consultationId: "cons-2", desk: "front_office", createdAt: day(-10) },
    { id: "fu-7", patientMrd: "MRD-1002", type: "test", dueDate: day(-2), status: "missed", ownerId: staffUsers[1].id, consultationId: "cons-6", desk: "front_office", createdAt: day(-6) },
    { id: "fu-8", patientMrd: "MRD-1005", type: "test", dueDate: today, status: "pending", ownerId: staffUsers[1].id, consultationId: "cons-4", desk: "front_office", createdAt: day(-1) },
  ];

  // --- Follow-up activity log + escalations (Module 9) ---
  const followUpActivities: Row[] = [
    { id: "fua-1", followUpId: "fu-2", contactMode: "call", outcome: "will_call_back", remarks: "Patient busy, asked to call evening", actorId: staffUsers[1].id, contactDate: day(-1), createdAt: day(-1) },
    { id: "fua-2", followUpId: "fu-6", contactMode: "whatsapp", outcome: "appointment_booked", remarks: "Review booked", actorId: staffUsers[1].id, contactDate: day(-5), createdAt: day(-5) },
    { id: "fua-3", followUpId: "fu-5", contactMode: "call", outcome: "medicine_taken_regularly", remarks: "Improving, continue course", actorId: staffUsers[1].id, contactDate: day(-3), createdAt: day(-3) },
    { id: "fua-4", followUpId: "fu-7", contactMode: "call", outcome: "therapy_missed", remarks: "Could not attend; reschedule", actorId: staffUsers[1].id, contactDate: day(-2), createdAt: day(-2) },
  ];
  const followUpEscalations: Row[] = [
    { id: "fue-1", followUpId: "fu-4", level: 4, escalatedToId: "stf-admin", reason: "Overdue 10d → management", status: "open", createdAt: day(-8) },
    { id: "fue-2", followUpId: "fu-1", level: 1, escalatedToId: "stf-admin", reason: "Overdue 1d → executive", status: "open", createdAt: day(-1) },
  ];

  // --- Tasks ---
  const tasks: Row[] = [
    { id: "task-1", type: "call_back_patient", subject: "Call back Meera Das", assigneeId: staffUsers[1].id, status: "open", priority: "high", dueDate: today, leadId: "lead-3", createdAt: day(-1) },
    { id: "task-2", type: "follow_up_admission", subject: "Admission follow-up Suresh", assigneeId: staffUsers[1].id, status: "in_progress", priority: "high", patientMrd: "MRD-1002", createdAt: day(-3) },
    { id: "task-3", type: "contact_dormant_patient", subject: "Reactivate Ravi Kumar", assigneeId: staffUsers[1].id, status: "open", priority: "medium", patientMrd: "MRD-DORMANT1", createdAt: day(-2) },
  ];

  // --- Referrals ---
  // --- Referrer profiles + relationship log (Module 6) ---
  const referrers: Row[] = [
    { id: "rf-doc1", type: "doctor", name: "Dr. Anil Kumar", specialty: "Ophthalmology", hospitalName: "City Eye Clinic, Kochi", phone: "9847090001", email: "anil@cityeye.test", location: "Kochi", relationManagerId: "stf-admin", lastMeetingDate: day(-10), nextFollowUp: day(20), score: 0, scoreFactors: null, active: true, createdAt: day(-120), updatedAt: day(-10) },
    { id: "rf-ayur1", type: "ayurveda_practitioner", name: "Vaidya Gopalan", specialty: "Kayachikitsa", hospitalName: "Gopalan Ayurveda Kendram", phone: "9847090002", location: "Kottayam", relationManagerId: "stf-admin", lastMeetingDate: day(-5), score: 0, scoreFactors: null, active: true, createdAt: day(-90), updatedAt: day(-5) },
    { id: "rf-hosp1", type: "hospital", name: "District Hospital Ernakulam", location: "Ernakulam", relationManagerId: "stf-admin", score: 0, scoreFactors: null, active: true, createdAt: day(-200), updatedAt: day(-30) },
    { id: "rf-corp1", type: "corporate", name: "Acme Industries", location: "Aluva", relationManagerId: "stf-admin", score: 0, scoreFactors: null, active: true, createdAt: day(-60), updatedAt: day(-20) },
  ];
  const referrerInteractions: Row[] = [
    { id: "ri-1", referrerId: "rf-doc1", type: "visit", outcome: "Reviewed referral pathway; agreed to a monthly CME", notes: "Met at the clinic", actorId: "stf-admin", at: day(-10), nextFollowUp: day(20), createdAt: day(-10) },
    { id: "ri-2", referrerId: "rf-doc1", type: "cme", outcome: "Hosted CME on cataract pathways — 18 attendees", actorId: "stf-admin", at: day(-30), createdAt: day(-30) },
    { id: "ri-3", referrerId: "rf-ayur1", type: "call", outcome: "Shared Panchakarma outcome summaries", actorId: "stf-admin", at: day(-5), nextFollowUp: day(10), createdAt: day(-5) },
  ];

  const referrals: Row[] = [
    { id: "ref-1", type: "patient_to_patient", status: "consulted", referrerPatientMrd: "MRD-1002", referredPatientMrd: "MRD-1002", revenue: 30000, createdAt: day(-15) },
    // Doctor referral with a full downstream chain (MRD-1003 → bk-camp1 → cons-camp1 → admitted adm-camp1 ₹50k).
    { id: "ref-2", type: "doctor", status: "admitted", referrerId: "rf-doc1", referrerName: "Dr. Anil Kumar", referredPatientMrd: "MRD-1003", revenue: 0, createdAt: day(-20) },
    { id: "ref-3", type: "ayurveda_practitioner", status: "consulted", referrerId: "rf-ayur1", referredPatientMrd: "MRD-1001", revenue: 0, createdAt: day(-25) },
    { id: "ref-4", type: "hospital", status: "pending", referrerId: "rf-hosp1", revenue: 0, createdAt: day(-6) },
  ];

  // --- Communications ---
  const communications: Row[] = [
    { id: "com-1", patientMrd: "MRD-1003", channel: "whatsapp", toAddress: "9847032345", status: "delivered", templateId: "tpl-0", body: "Appointment confirmed", sentAt: day(-1), createdAt: day(-1) },
    { id: "com-2", patientMrd: "MRD-1001", channel: "sms", toAddress: "9847012345", status: "sent", templateId: "tpl-1", body: "Follow-up reminder", sentAt: day(-2), createdAt: day(-2) },
    { id: "com-3", patientMrd: "MRD-1005", channel: "whatsapp", toAddress: "9847052345", status: "failed", body: "Reactivation", createdAt: day(-3) },
  ];

  // --- Calls ---
  const callLogs: Row[] = [
    { id: "call-1", leadId: "lead-1", executiveId: staffUsers[1].id, outcome: "appointment_booked", durationSec: 240, notes: "Booked eval", createdAt: day(-3) },
    { id: "call-2", leadId: "lead-3", executiveId: staffUsers[1].id, outcome: "follow_up_required", durationSec: 120, createdAt: day(-2) },
    { id: "call-3", leadId: "lead-5", executiveId: staffUsers[1].id, outcome: "not_reachable", durationSec: 0, createdAt: today },
  ];

  // --- Waitlist ---
  const waitlist: Row[] = [
    { id: "wl-1", patientMrd: "MRD-1005", doctorId: doctors[2].id, departmentId: departments[0].id, requestedDate: day(2), priority: 1, status: "waiting", createdAt: day(-1) },
  ];

  // --- Retention ---
  const retentionStatus: Row[] = [
    { patientMrd: "MRD-1002", category: "active", riskScore: 10, successOwnerId: null, lastEvaluatedAt: day(-1) },
    { patientMrd: "MRD-1005", category: "at_risk", riskScore: 55, successOwnerId: staffUsers[1].id, lastEvaluatedAt: day(-1) },
    { patientMrd: "MRD-DORMANT1", category: "dormant", riskScore: 80, successOwnerId: staffUsers[1].id, lastEvaluatedAt: day(-1) },
  ];
  const patientScores: Row[] = [
    { id: "ps-ret-1", patientMrd: "MRD-1002", kind: "retention", score: 90, factors: { base: 50, repeatVisit: 15, referralGiven: 10 }, computedAt: day(-1) },
    { id: "ps-wel-1", patientMrd: "MRD-1002", kind: "wellness", score: 82, factors: { adherence: 36, therapy: 28, followUp: 18 }, computedAt: day(-1) },
    { id: "ps-ret-2", patientMrd: "MRD-1005", kind: "retention", score: 45, factors: { base: 50, noVisit: -10 }, computedAt: day(-1) },
    { id: "ps-wel-2", patientMrd: "MRD-1005", kind: "wellness", score: 54, factors: { adherence: 24, therapy: 17, followUp: 13 }, computedAt: day(-1) },
    { id: "ps-ret-3", patientMrd: "MRD-DORMANT1", kind: "retention", score: 20, factors: { base: 50, noVisit: -30 }, computedAt: day(-1) },
    { id: "ps-wel-3", patientMrd: "MRD-DORMANT1", kind: "wellness", score: 30, factors: { adherence: 12, therapy: 11, followUp: 7 }, computedAt: day(-1) },
  ];
  const retentionActivities: Row[] = [
    { id: "ra-1", patientMrd: "MRD-DORMANT1", contactDate: day(-10), contactMode: "call", outcome: "no_answer", remarks: "Phone unanswered", actorId: staffUsers[1].id, campaignId: "camp-react-1", createdAt: day(-10) },
    { id: "ra-2", patientMrd: "MRD-DORMANT1", contactDate: day(-5), contactMode: "whatsapp", outcome: "callback_later", remarks: "Asked to call after festival", actorId: staffUsers[1].id, campaignId: "camp-react-1", createdAt: day(-5) },
    { id: "ra-3", patientMrd: "MRD-1005", contactDate: day(-3), contactMode: "call", outcome: "promised_visit", remarks: "Will visit next week", actorId: staffUsers[1].id, campaignId: null, createdAt: day(-3) },
  ];

  // --- Campaigns ---
  const campaigns: Row[] = [
    { id: "camp-1", name: "Cataract Awareness June", type: "facebook_ads", budget: 5000000, sourceId: leadSources[2].id, targetLocation: "Kochi", targetDistrict: "Ernakulam", targetDisease: "Cataract", targetAgeMin: 45, targetAgeMax: 75, targetGender: "all", targetAudience: "Seniors with blurred vision / cataract symptoms", status: "running", launchedAt: day(-3), active: true, createdAt: day(-30) },
    { id: "camp-2", name: "Diabetic Eye Camp", type: "camp", budget: 2000000, targetLocation: "Thrissur", targetDistrict: "Thrissur", targetDisease: "Diabetic retinopathy", targetAgeMin: 35, targetAgeMax: 70, targetGender: "all", targetAudience: "Known diabetics, retinopathy screening", status: "running", launchedAt: day(-1), active: true, createdAt: day(-15) },
    { id: "camp-3", name: "Glaucoma Screening Drive (planning)", type: "google_ads", budget: 3000000, sourceId: leadSources[2].id, targetLocation: "Kozhikode", targetDistrict: "Kozhikode", targetDisease: "Glaucoma", targetAgeMin: 50, targetAgeMax: 80, targetGender: "all", targetAudience: "Seniors with family history of glaucoma", status: "planned", launchedAt: null, active: true, createdAt: day(-2) },
    { id: "camp-react-1", name: "Panchakarma Renewal — Monsoon", type: "whatsapp", program: "panchakarma_renewal", budget: 0, status: "running", launchedAt: day(-11), active: true, createdAt: day(-12) },
  ];
  // Marketing-channel master (rate cards) + seasonal offers.
  const marketingChannels: Row[] = [
    { id: "mch-yt", name: "YouTube", pricingModel: "cpm", baseRate: 50000, minReach: 5000, active: true, notes: "Reels / pre-roll", createdAt: day(-60) },
    { id: "mch-insta", name: "Instagram", pricingModel: "cpm", baseRate: 60000, minReach: 5000, active: true, notes: "Reels + feed", createdAt: day(-60) },
    { id: "mch-fb", name: "Facebook", pricingModel: "cpm", baseRate: 45000, minReach: 5000, active: true, createdAt: day(-60) },
    { id: "mch-google", name: "Google Ads", pricingModel: "cpc", baseRate: 1200, active: true, notes: "Search + display", createdAt: day(-60) },
    { id: "mch-wa", name: "WhatsApp", pricingModel: "flat", baseRate: 800000, active: true, notes: "Broadcast blast", createdAt: day(-60) },
  ];
  // Per-desk call talking-points / checklist (Module 2).
  const callChecklistItems: Row[] = [
    // Reception — inbound enquiry
    { id: "cl-r1", label: "Verify caller name & phone", desk: "reception", section: "identity", mandatory: true, responseType: "checkbox", sortOrder: 1, active: true, createdAt: day(-40) },
    { id: "cl-r2", label: "Existing patient?", desk: "reception", section: "identity", promptHint: "Ask if they've visited before; capture MRD if yes.", mandatory: false, responseType: "yes_no_na", sortOrder: 2, active: true, createdAt: day(-40) },
    { id: "cl-r3", label: "Capture chief complaint", desk: "reception", section: "clinical", mandatory: true, responseType: "short_text", sortOrder: 3, active: true, createdAt: day(-40) },
    { id: "cl-r4", label: "Shared clinic timings & location", desk: "reception", section: "general", responseType: "checkbox", sortOrder: 4, active: true, createdAt: day(-40) },
    { id: "cl-r5", label: "Offered an appointment slot", desk: "reception", section: "next_step", mandatory: true, responseType: "checkbox", sortOrder: 5, active: true, createdAt: day(-40) },
    // Back office — lead nurture
    { id: "cl-b1", label: "Confirmed interest & disease area", desk: "back_office", section: "clinical", mandatory: true, responseType: "checkbox", sortOrder: 1, active: true, createdAt: day(-40) },
    { id: "cl-b2", label: "Explained relevant treatment", desk: "back_office", section: "clinical", promptHint: "Briefly explain the Ayurvedic treatment for their complaint.", responseType: "checkbox", sortOrder: 2, active: true, createdAt: day(-40) },
    { id: "cl-b3", label: "Shared doctor credentials", desk: "back_office", section: "commercial", responseType: "checkbox", sortOrder: 3, active: true, createdAt: day(-40) },
    { id: "cl-b4", label: "Discussed approx cost / package", desk: "back_office", section: "commercial", responseType: "short_text", sortOrder: 4, active: true, createdAt: day(-40) },
    { id: "cl-b5", label: "Objection / concern raised", desk: "back_office", section: "commercial", promptHint: "Note any hesitation (cost, distance, time).", responseType: "short_text", sortOrder: 5, active: true, createdAt: day(-40) },
    { id: "cl-b6", label: "Proposed branch visit / appointment", desk: "back_office", section: "next_step", mandatory: true, responseType: "checkbox", sortOrder: 6, active: true, createdAt: day(-40) },
    { id: "cl-b7", label: "Agreed next contact date", desk: "back_office", section: "next_step", responseType: "checkbox", sortOrder: 7, active: true, createdAt: day(-40) },
    // Front office — patient review
    { id: "cl-f1", label: "Confirmed recovery / current symptoms", desk: "front_office", section: "clinical", mandatory: true, responseType: "short_text", sortOrder: 1, active: true, createdAt: day(-40) },
    { id: "cl-f2", label: "Medication adherence checked", desk: "front_office", section: "clinical", responseType: "yes_no_na", sortOrder: 2, active: true, createdAt: day(-40) },
    { id: "cl-f3", label: "Advised next review / test", desk: "front_office", section: "next_step", responseType: "checkbox", sortOrder: 3, active: true, createdAt: day(-40) },
    { id: "cl-f4", label: "Reschedule needed?", desk: "front_office", section: "next_step", responseType: "yes_no_na", sortOrder: 4, active: true, createdAt: day(-40) },
    { id: "cl-f5", label: "Satisfaction check", desk: "front_office", section: "general", responseType: "yes_no_na", sortOrder: 5, active: true, createdAt: day(-40) },
    // Any desk
    { id: "cl-a1", label: "Consent to contact confirmed", desk: "any", section: "general", responseType: "checkbox", sortOrder: 9, active: true, createdAt: day(-40) },
  ];
  const channelSeasonalOffers: Row[] = [
    { id: "off-1", channelMasterId: "mch-insta", name: "Onam reach offer", fromDate: day(-10), toDate: day(20), discountPct: null, bonusReachPct: 15, active: true, createdAt: day(-12) },
    { id: "off-2", channelMasterId: "mch-google", name: "Festive discount", fromDate: day(-5), toDate: day(15), discountPct: 10, bonusReachPct: null, active: true, createdAt: day(-6) },
    { id: "off-3", channelMasterId: "mch-yt", name: "New-year bundle", fromDate: day(120), toDate: day(150), discountPct: 12, bonusReachPct: 10, active: true, createdAt: day(-3) },
  ];
  const campaignChannels: Row[] = [
    { id: "cc-1", campaignId: "camp-1", channel: "youtube", channelMasterId: "mch-yt", promisedReach: 40000, achievedReach: 38500, quotedCost: 2000000, createdAt: day(-5) },
    { id: "cc-2", campaignId: "camp-1", channel: "instagram", channelMasterId: "mch-insta", promisedReach: 25000, achievedReach: 27200, quotedCost: 1500000, createdAt: day(-5) },
    { id: "cc-3", campaignId: "camp-1", channel: "google_ads", channelMasterId: "mch-google", promisedReach: 30000, achievedReach: 26000, quotedCost: 1500000, createdAt: day(-5) },
    { id: "cc-4", campaignId: "camp-2", channel: "whatsapp", channelMasterId: "mch-wa", promisedReach: 15000, achievedReach: 14200, quotedCost: 800000, createdAt: day(-3) },
    { id: "cc-5", campaignId: "camp-2", channel: "facebook", channelMasterId: "mch-fb", promisedReach: 20000, achievedReach: null, quotedCost: 1200000, createdAt: day(-3) },
    { id: "cc-6", campaignId: "camp-3", channel: "Google Ads", channelMasterId: "mch-google", promisedReach: 22000, achievedReach: null, quotedCost: 2376000, createdAt: day(-2) },
  ];

  // --- Organizations / Camps / Mobile clinics ---
  const organizations: Row[] = [
    { id: "org-1", name: "St. Mary's School", type: "school", nextEngagement: day(14), contactPersons: [{ name: "Principal", role: "Head" }], createdAt: day(-90) },
    { id: "org-2", name: "Acme Corp", type: "company", nextEngagement: null, contactPersons: [], createdAt: day(-60) },
  ];
  const organizationEngagements: Row[] = [
    { id: "oe-1", organizationId: "org-1", type: "visit", outcome: "Agreed to host an eye camp next month", notes: "Met the principal; ~300 students", actorId: "stf-camp", at: day(-12), createdAt: day(-12) },
  ];
  const camps: Row[] = [
    {
      id: "cmp-1", name: "Eye Camp Koothattukulam", location: "Koothattukulam", district: "Ernakulam", venue: "Town Auditorium", venueCapacity: 150, branchId: branches[0].id, diseaseId: diseases[0].id,
      organizerId: "org-1", status: "completed", isRecurring: true, expectedPatients: 80, expectedAdmissions: 6, revenue: 150000, createdAt: day(-20),
      planning: { locationIdentified: true, venueBooked: true, existingPatientsContacted: true, adsReleased: true, staffArranged: true, mobileUnitArranged: true },
      expenses: [
        { category: "venue_rent", planned: 500000, actual: 480000, note: "Town auditorium" },
        { category: "transport_driver", planned: 300000, actual: 320000, note: "Bus + driver bata" },
        { category: "food_consumables", planned: 200000, actual: 180000 },
        { category: "marketing_ads", planned: 400000, actual: 250000, note: "Local FB/Insta" },
      ],
      staffRoster: [
        { role: "doctor", name: "Dr. Menon", honorarium: 400000 },
        { role: "optometrist", name: "Anu", honorarium: 150000 },
        { role: "driver", name: "Saji", honorarium: 80000 },
        { role: "attender", name: "Ravi", honorarium: 60000 },
      ],
      revenueLines: [
        { kind: "registration", amount: 200000 },
        { kind: "optometry_checkup", amount: 300000 },
        { kind: "medicine_sales", amount: 800000 },
      ],
    },
    { id: "cmp-2", name: "Vision Screening Kochi", location: "Ernakulam", district: "Ernakulam", branchId: branches[1].id, organizerId: null, status: "planned", isRecurring: false, expectedPatients: 50, revenue: 0, createdAt: day(-3),
      planning: { locationIdentified: true, venueBooked: false, existingPatientsContacted: false, adsReleased: false },
      expenses: [{ category: "venue_rent", planned: 350000, actual: null }, { category: "marketing_ads", planned: 300000, actual: null }],
      staffRoster: [], revenueLines: [] },
    // Completed SAEC camp with actuals so the Ernakulam cost centre has real spend + on-site revenue.
    { id: "cmp-3", name: "Netra Camp Ernakulam", location: "Ernakulam", district: "Ernakulam", venue: "Parish Hall", venueCapacity: 100, branchId: branches[1].id, diseaseId: diseases[0].id,
      organizerId: null, status: "completed", isRecurring: false, expectedPatients: 60, expectedAdmissions: 4, revenue: 90000, createdAt: day(-14),
      planning: { locationIdentified: true, venueBooked: true, existingPatientsContacted: true, adsReleased: true, staffArranged: true },
      expenses: [
        { category: "venue_rent", planned: 400000, actual: 380000 },
        { category: "transport_driver", planned: 200000, actual: 210000 },
        { category: "marketing_ads", planned: 250000, actual: 200000 },
      ],
      staffRoster: [
        { role: "doctor", name: "Dr. Pillai", honorarium: 300000 },
        { role: "optometrist", name: "Meera", honorarium: 120000 },
      ],
      revenueLines: [
        { kind: "registration", amount: 150000 },
        { kind: "optometry_checkup", amount: 240000 },
        { kind: "medicine_sales", amount: 510000 },
      ],
    },
  ];
  const campPatients: Row[] = [
    { id: "cp-1", campId: "cmp-1", contactName: "Ramesh", phone: "9847090001", complaint: "Blurred vision", riskCategory: "admission_candidate", screenedById: "stf-menon", recommendedVisit: true, leadId: "lead-camp1", createdAt: day(-20) },
    { id: "cp-2", campId: "cmp-1", contactName: "Geetha", phone: "9847090002", complaint: "Itchy eyes", riskCategory: "normal", screenedById: "stf-menon", recommendedVisit: false, createdAt: day(-20) },
    { id: "cp-3", campId: "cmp-1", contactName: "Latha", phone: "9847090003", complaint: "Eye strain", riskCategory: "follow_up", screenedById: "stf-callexec", recommendedVisit: true, createdAt: day(-20) },
  ];
  const mobileClinics: Row[] = [
    { id: "mc-1", routeName: "Route A — Idukki", location: "Idukki", district: "Idukki", venue: "Panchayat hall", venueCapacity: 60, branchId: branches[0].id, status: "completed", isRecurring: false, expectedPatients: 40, expectedAdmissions: 3, createdAt: day(-18),
      planning: { locationIdentified: true, venueBooked: true, mobileUnitArranged: true, adsReleased: true },
      expenses: [{ category: "transport_driver", planned: 250000, actual: 260000, note: "Van fuel + driver" }, { category: "food_consumables", planned: 120000, actual: 110000 }],
      staffRoster: [{ role: "optometrist", name: "Deepa", honorarium: 150000 }, { role: "driver", name: "Manoj", honorarium: 70000 }],
      revenueLines: [{ kind: "optometry_checkup", amount: 150000 }, { kind: "medicine_sales", amount: 220000 }] },
  ];
  const mobileClinicPatients: Row[] = [
    { id: "mcp-1", mobileClinicId: "mc-1", contactName: "Joy", phone: "9847091001", complaint: "Cataract suspected", riskCategory: "high_priority", screenedById: "stf-menon", referredToBranch: true, leadId: "lead-mob1", createdAt: day(-18) },
    { id: "mcp-2", mobileClinicId: "mc-1", contactName: "Suma", phone: "9847091002", complaint: "Routine checkup", riskCategory: "normal", screenedById: "stf-menon", referredToBranch: false, createdAt: day(-18) },
  ];

  // Downstream chain for outreach ROI: camp screening → lead → booking → consultation → admitted admission
  // (attributed to the Kochi branch). Pushed onto the earlier arrays before relation wiring runs.
  const campSourceId = leadSources.find((s) => s.name === "camp")?.id ?? null;
  const mobileSourceId = leadSources.find((s) => s.name === "mobile_clinic")?.id ?? null;
  leads.push(
    { id: "lead-camp1", leadNumber: "LEAD-2026-000010", contactName: "Ramesh", phone: "9847090001", stage: "converted_to_patient", sourceId: campSourceId, ownerId: staffUsers[1].id, branchId: branches[0].id, patientMrd: "MRD-1003", mergedIntoId: null, desk: "back_office", createdAt: day(-19) },
    { id: "lead-mob1", leadNumber: "LEAD-2026-000011", contactName: "Joy", phone: "9847091001", stage: "interested", sourceId: mobileSourceId, ownerId: staffUsers[1].id, branchId: branches[0].id, mergedIntoId: null, desk: "back_office", createdAt: day(-18) },
  );
  bookings.push(
    { id: "bk-camp1", bookingRef: "OP-CAMP1", patientMrd: "MRD-1003", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[1].id, appointmentDate: day(-10), startTime: "10:00", status: "completed", source: "camp", appointmentType: "camp_follow_up", bookedAt: day(-12), bookedBy: "stf-callexec", leadId: "lead-camp1", completedAt: day(-10) },
  );
  consultations.push(
    { id: "cons-camp1", bookingId: "bk-camp1", patientMrd: "MRD-1003", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[1].id, diseaseId: diseases[0].id, fee: 3000_00, outcome: "admission_advised", diagnosis: "Cataract — camp referral", createdAt: day(-10) },
  );
  admissions.push(
    { id: "adm-camp1", patientMrd: "MRD-1003", consultationId: "cons-camp1", doctorId: doctors[1].id, packageId: admissionPackages[2].id, estimatedCost: 5000000, status: "admitted", createdAt: day(-9), updatedAt: day(-8) },
  );

  // Multi-centre activity (SAEC network) so company/group consolidation has
  // real per-centre numbers beyond the flagship.
  leads.push(
    { id: "lead-che1", leadNumber: "LEAD-2026-000012", contactName: "Karthik Subramanian", phone: "9884010001", gender: "male", age: 64, city: "Chennai", district: "Chennai", chiefComplaint: "Cataract enquiry", diseaseId: diseases[0].id, stage: "converted_to_patient", sourceId: leadSources[2].id, ownerId: "stf-chembr", branchId: "br-che", patientMrd: "MRD-1006", mergedIntoId: null, desk: "back_office", createdAt: day(-9) },
    { id: "lead-che2", leadNumber: "LEAD-2026-000013", contactName: "Revathi Iyer", phone: "9884010002", gender: "female", age: 58, city: "Chennai", district: "Chennai", chiefComplaint: "Dry eye, screen strain", diseaseId: diseases[2].id, stage: "contacted", sourceId: leadSources[0].id, ownerId: "stf-chembr", branchId: "br-che", mergedIntoId: null, desk: "back_office", lastContactAt: day(-1), createdAt: day(-4) },
    { id: "lead-blr1", leadNumber: "LEAD-2026-000014", contactName: "Manjunath R", phone: "9900010003", gender: "male", age: 49, city: "Bangalore", district: "Bangalore Urban", chiefComplaint: "Diabetic retinopathy screening", diseaseId: diseases[4].id, stage: "interested", sourceId: leadSources[1].id, ownerId: null, branchId: "br-blr", mergedIntoId: null, desk: "back_office", createdAt: day(-6) },
    { id: "lead-knr1", leadNumber: "LEAD-2026-000015", contactName: "Sajna K", phone: "9745010004", gender: "female", age: 41, city: "Kannur", district: "Kannur", chiefComplaint: "Allergic conjunctivitis", diseaseId: diseases[3].id, stage: "new_lead", sourceId: leadSources[9].id, ownerId: null, branchId: "br-knr", mergedIntoId: null, desk: "reception", createdAt: day(-1) },
    { id: "lead-ktm1", leadNumber: "LEAD-2026-000016", contactName: "Joseph Chacko", phone: "9447010005", gender: "male", age: 55, city: "Kottayam", district: "Kottayam", chiefComplaint: "Glaucoma review enquiry", diseaseId: diseases[1].id, stage: "appointment_booked", sourceId: leadSources[3].id, ownerId: null, branchId: "br-ktm-op", mergedIntoId: null, desk: "reception", createdAt: day(-2) },
  );
  bookings.push(
    { id: "bk-che1", bookingRef: "OP-CHE1", patientMrd: "MRD-1006", doctorId: doctors[3].id, departmentId: departments[1].id, branchId: "br-che", appointmentDate: day(-7), startTime: "10:00", status: "completed", source: "call_centre", appointmentType: "regular", bookedAt: day(-8), bookedBy: "stf-chembr", leadId: "lead-che1", completedAt: day(-7) },
    { id: "bk-che2", bookingRef: "OP-CHE2", patientMrd: "MRD-1007", doctorId: doctors[3].id, departmentId: departments[1].id, branchId: "br-che", appointmentDate: today, startTime: "11:30", status: "booked", source: "front_desk", appointmentType: "regular", bookedAt: day(-1), bookedBy: "stf-chembr" },
    { id: "bk-blr1", bookingRef: "OP-BLR1", patientMrd: "MRD-1005", doctorId: doctors[4].id, departmentId: departments[1].id, branchId: "br-blr", appointmentDate: day(-3), startTime: "09:30", status: "completed", source: "online", appointmentType: "regular", bookedAt: day(-5), bookedBy: "stf-callexec", completedAt: day(-3) },
  );
  consultations.push(
    { id: "cons-che1", bookingId: "bk-che1", patientMrd: "MRD-1006", doctorId: doctors[3].id, departmentId: departments[1].id, branchId: "br-che", diseaseId: diseases[0].id, fee: 5000_00, outcome: "admission_advised", diagnosis: "Cataract (R)", advice: "Panchakarma + surgery counselling", createdAt: day(-7) },
    { id: "cons-blr1", bookingId: "bk-blr1", patientMrd: "MRD-1005", doctorId: doctors[4].id, departmentId: departments[1].id, branchId: "br-blr", diseaseId: diseases[4].id, fee: 4000_00, outcome: "medicine_prescribed", diagnosis: "Early diabetic retinopathy", advice: "Internal medication + 3-month review", createdAt: day(-3) },
  );
  admissions.push(
    { id: "adm-che1", patientMrd: "MRD-1006", consultationId: "cons-che1", doctorId: doctors[3].id, packageId: admissionPackages[0].id, estimatedCost: 2500000, status: "counselled", createdAt: day(-6), updatedAt: day(-5) },
  );

  // --- Audit ---
  const auditLog: Row[] = [
    { id: "aud-1", actorId: staffUsers[0].id, action: "lead.create", entity: "lead", entityId: "lead-1", createdAt: day(-3) },
    { id: "aud-2", actorId: staffUsers[3].id, action: "consultation.create", entity: "consultation", entityId: "cons-1", createdAt: day(-5) },
  ];

  // Per-lead activity timeline seed (calls/stage-changes/notes augment these).
  const leadActivities: Row[] = [
    { id: "la-1", leadId: "lead-1", kind: "created", summary: "Lead created from Website form", actorId: staffUsers[0].id, createdAt: day(-3) },
    { id: "la-2", leadId: "lead-1", kind: "assigned", summary: "Assigned to Call Exec", actorId: staffUsers[0].id, createdAt: day(-3) },
    { id: "la-3", leadId: "lead-2", kind: "created", summary: "Lead created from Google Ads", actorId: staffUsers[0].id, createdAt: day(-6) },
    { id: "la-4", leadId: "lead-2", kind: "note", summary: "Note added", detail: "Patient asked about consultation cost", actorId: staffUsers[1].id, createdAt: day(-1) },
    { id: "la-5", leadId: "lead-3", kind: "created", summary: "Lead created from Social media", actorId: staffUsers[0].id, createdAt: day(-8) },
    { id: "la-6", leadId: "lead-3", kind: "stage_change", summary: "Stage → interested", actorId: staffUsers[1].id, createdAt: day(-2) },
  ];

  const leadAssignments: Row[] = [
    { id: "lasg-1", leadId: "lead-1", fromOwnerId: null, toOwnerId: staffUsers[1].id, reason: "auto: branch + disease", actorId: staffUsers[0].id, createdAt: day(-3) },
    { id: "lasg-2", leadId: "lead-2", fromOwnerId: null, toOwnerId: staffUsers[1].id, reason: "auto: digital lead", actorId: staffUsers[0].id, createdAt: day(-6) },
  ];

  // ---- Wire cross-references by reference ----
  const byId = <T extends Row>(arr: T[], id: string | null | undefined, key = "id") => arr.find((r) => r[key] === id);
  const patientMini = (mrd: string) => { const p = byId(patients, mrd, "mrd"); return p ? { mrd: p.mrd, name: p.name } : null; };

  leads.forEach((l) => {
    l.source = byId(leadSources, l.sourceId) ?? null;
    l.disease = byId(diseases, l.diseaseId) ?? null;
    l.owner = byId(staffUsers, l.ownerId) ?? null;
    l.branch = byId(branches, l.branchId) ?? null;
    l.calls = callLogs.filter((c) => c.leadId === l.id);
    l.activities = leadActivities.filter((a) => a.leadId === l.id);
    l.assignments = leadAssignments.filter((a) => a.leadId === l.id);
  });
  callLogs.forEach((c) => { c.lead = byId(leads, c.leadId) ?? null; });
  leadActivities.forEach((a) => { a.lead = byId(leads, a.leadId) ?? null; a.actor = byId(staffUsers, a.actorId) ?? null; });
  leadAssignments.forEach((a) => { a.lead = byId(leads, a.leadId) ?? null; a.fromOwner = byId(staffUsers, a.fromOwnerId) ?? null; a.toOwner = byId(staffUsers, a.toOwnerId) ?? null; });
  bookings.forEach((b) => {
    b.patient = byId(patients, b.patientMrd, "mrd");
    b.doctor = byId(doctors, b.doctorId);
    b.department = byId(departments, b.departmentId);
    b.branch = byId(branches, b.branchId) ?? null;
    b.room = byId(consultationRooms, b.roomId) ?? null;
    b.consultation = consultations.find((c) => c.bookingId === b.id) ?? null;
    b.statusHistory = appointmentStatusHistory.filter((h) => h.bookingId === b.id);
    b.reminders = appointmentReminders.filter((r) => r.bookingId === b.id);
  });
  doctorSchedules.forEach((s) => { s.doctor = byId(doctors, s.doctorId) ?? null; s.department = byId(departments, s.departmentId) ?? null; });
  timeSlots.forEach((s) => { s.doctor = byId(doctors, s.doctorId) ?? null; s.department = byId(departments, s.departmentId) ?? null; });
  appointmentStatusHistory.forEach((h) => { h.booking = byId(bookings, h.bookingId) ?? null; });
  appointmentReminders.forEach((r) => { r.booking = byId(bookings, r.bookingId) ?? null; });
  doctorLeaves.forEach((l) => { l.doctor = byId(doctors, l.doctorId) ?? null; });
  campaigns.forEach((c) => { c.channels = campaignChannels.filter((ch) => ch.campaignId === c.id); });
  campaignChannels.forEach((ch) => { ch.campaign = byId(campaigns, ch.campaignId) ?? null; ch.channelMaster = byId(marketingChannels, ch.channelMasterId) ?? null; });
  marketingChannels.forEach((m) => { m.offers = channelSeasonalOffers.filter((o) => o.channelMasterId === m.id); });
  channelSeasonalOffers.forEach((o) => { o.channel = byId(marketingChannels, o.channelMasterId) ?? null; });
  consultations.forEach((c) => {
    c.patient = byId(patients, c.patientMrd, "mrd");
    c.doctor = byId(doctors, c.doctorId);
    c.department = byId(departments, c.departmentId);
    c.disease = byId(diseases, c.diseaseId) ?? null;
    c.booking = byId(bookings, c.bookingId) ?? null;
    c.labReferrals = labReferrals.filter((l) => l.consultationId === c.id);
    c.treatmentPlan = treatmentPlans.find((t) => t.consultationId === c.id) ?? null;
  });
  labReferrals.forEach((l) => { l.consultation = byId(consultations, l.consultationId) ?? null; });
  treatmentPlans.forEach((t) => { t.consultation = byId(consultations, t.consultationId) ?? null; });
  admissions.forEach((a) => { a.patient = byId(patients, a.patientMrd, "mrd"); a.package = byId(admissionPackages, a.packageId) ?? null; });
  followUps.forEach((f) => {
    f.patient = byId(patients, f.patientMrd, "mrd"); f.doctor = byId(doctors, f.doctorId) ?? null;
    f.activities = followUpActivities.filter((a) => a.followUpId === f.id);
    f.escalations = followUpEscalations.filter((e) => e.followUpId === f.id);
  });
  followUpActivities.forEach((a) => { a.followUp = byId(followUps, a.followUpId) ?? null; });
  followUpEscalations.forEach((e) => { e.followUp = byId(followUps, e.followUpId) ?? null; });
  tasks.forEach((t) => { t.assignee = byId(staffUsers, t.assigneeId) ?? null; t.lead = byId(leads, t.leadId) ?? null; });
  referrals.forEach((r) => {
    r.referrerPatient = r.referrerPatientMrd ? patientMini(r.referrerPatientMrd) : null;
    r.referredPatient = r.referredPatientMrd ? patientMini(r.referredPatientMrd) : null;
    r.organization = byId(organizations, r.organizationId) ?? null;
    r.referrer = byId(referrers, r.referrerId) ?? null;
  });
  referrers.forEach((rf) => {
    rf.relationManager = byId(staffUsers, rf.relationManagerId) ?? null;
    rf.referrals = referrals.filter((r) => r.referrerId === rf.id);
    rf.interactions = referrerInteractions.filter((i) => i.referrerId === rf.id);
    rf._count = { referrals: rf.referrals.length, interactions: rf.interactions.length };
  });
  referrerInteractions.forEach((i) => { i.referrer = byId(referrers, i.referrerId) ?? null; });
  communications.forEach((c) => { c.patient = byId(patients, c.patientMrd, "mrd"); c.template = byId(communicationTemplates, c.templateId) ?? null; });
  waitlist.forEach((w) => { w.patient = byId(patients, w.patientMrd, "mrd"); w.doctor = byId(doctors, w.doctorId) ?? null; });
  retentionStatus.forEach((r) => { r.patient = byId(patients, r.patientMrd, "mrd"); });
  camps.forEach((c) => { c.organizer = byId(organizations, c.organizerId) ?? null; c.campPatients = campPatients.filter((p) => p.campId === c.id); c._count = { campPatients: c.campPatients.length }; });
  mobileClinics.forEach((m) => { m.patients = mobileClinicPatients.filter((p) => p.mobileClinicId === m.id); m._count = { patients: m.patients.length }; });
  organizations.forEach((o) => {
    o.camps = camps.filter((c) => c.organizerId === o.id);
    o.referrals = referrals.filter((r) => r.organizationId === o.id);
    o._count = { camps: o.camps.length, referrals: o.referrals.length };
  });
  auditLog.forEach((a) => { a.actor = byId(staffUsers, a.actorId) ?? null; });

  patients.forEach((p) => {
    p.bookings = bookings.filter((b) => b.patientMrd === p.mrd);
    p.leads = leads.filter((l) => l.patientMrd === p.mrd);
    p.followUps = followUps.filter((f) => f.patientMrd === p.mrd);
    p.communications = communications.filter((c) => c.patientMrd === p.mrd);
    p.admissionRecs = admissions.filter((a) => a.patientMrd === p.mrd);
    p.referralsGiven = referrals.filter((r) => r.referrerPatientMrd === p.mrd);
    p.referralsGot = referrals.filter((r) => r.referredPatientMrd === p.mrd);
    p.consultations = consultations.filter((c) => c.patientMrd === p.mrd);
    p.documents = [];
    p.retention = byId(retentionStatus, p.mrd, "patientMrd") ?? null;
    p.scores = patientScores.filter((s) => s.patientMrd === p.mrd);
    p.retentionActivities = retentionActivities.filter((a) => a.patientMrd === p.mrd);
  });
  retentionActivities.forEach((a) => { a.patient = byId(patients, a.patientMrd, "mrd"); });
  retentionStatus.forEach((r) => { r.activities = retentionActivities.filter((a) => a.patientMrd === r.patientMrd); });

  const isoDay = (n: number) => day(n).toISOString().slice(0, 10);
  // An already-approved typed activity (entered by staff → verified by supervisor → approved by manager).
  const appr = (typeKey: string, title: string, target: number): Row => ({
    title, typeKey, target, ownerId: staffUsers[1].id, dueDate: null, budget: null, status: "planned", taskId: null, draftEntityId: null,
    approval: { status: "approved", enteredById: staffUsers[1].id, enteredAt: isoDay(-10), verifiedById: "stf-superv", verifiedAt: isoDay(-9), approvedById: staffUsers[0].id, approvedAt: isoDay(-8) },
    changeLog: [
      { at: isoDay(-10), byId: staffUsers[1].id, byRank: "staff", action: "entered" },
      { at: isoDay(-9), byId: "stf-superv", byRank: "supervisor", action: "verified" },
      { at: isoDay(-8), byId: staffUsers[0].id, byRank: "manager", action: "approved" },
    ],
  });
  // Scope: branchId set => centre plan; companyId only => company plan; both null => group plan.
  const mkPlan = (slug: string, title: string, acts: Row[], budget = 0, targets: Row[] = [], scope: { branchId?: string | null; companyId?: string | null } = {}): Row => ({
    id: scope.branchId ? `plan-${slug}-${scope.branchId}` : scope.companyId ? `plan-${slug}-${scope.companyId}` : `plan-${slug}`,
    moduleSlug: slug, title, period: "2026-Q3", periodStart: day(-30), periodEnd: day(60),
    branchId: scope.branchId ?? null, companyId: scope.companyId ?? null,
    objective: `${title} objectives.`, status: "active", ownerId: staffUsers[0].id, plannedBudget: budget, targets, activities: acts, createdAt: day(-30), updatedAt: day(-2),
  });
  // A mid-workflow (entered, awaiting verification) activity to demo the 3 steps on the leads plan.
  const enteredAct: Row = {
    title: "Festival call drive", typeKey: "call_drive", target: 50, ownerId: staffUsers[1].id, dueDate: null, budget: null, status: "planned", taskId: null, draftEntityId: null,
    approval: { status: "entered", enteredById: staffUsers[1].id, enteredAt: isoDay(-2) },
    changeLog: [{ at: isoDay(-2), byId: staffUsers[1].id, byRank: "staff", action: "entered" }],
  };
  const modulePlans: Row[] = [
    mkPlan("leads", "Lead Management — Q3", [appr("generate_leads", "Lead generation drive", 200), enteredAct], 5000000, [
      { kpiLabel: "New leads", label: "New leads", target: 200, unit: "" },
      { kpiLabel: "Converted", label: "Converted", target: 30, unit: "" },
    ]),
    // Camps plan adopts the vision's camp activity (amended: 6 camps at ₹60,000 vs master 24 @ ₹1,92,000 total) — feeds the variance report.
    mkPlan("camps", "Outreach Camps — Q3", [{ ...appr("conduct_camp", "Conduct 6 camps", 6), budget: 60000_00, masterActivityId: "mp-act-1", draftEntityId: "cmp-1" }], 12000000, [{ kpiLabel: "All camps", label: "Camps", target: 6, unit: "" }]),
    mkPlan("mobile-clinics", "Mobile Routes — Q3", [appr("run_route", "Run 4 routes", 4)], 3000000),
    mkPlan("campaigns", "Campaigns — Q3", [appr("launch_campaign", "Launch 3 campaigns", 3)], 8000000),
    mkPlan("appointments", "Clinics — Q3", [appr("doctor_schedule", "Doctor schedules", 10)]),
    mkPlan("referrals", "Referrals — Q3", [appr("referral_drive", "Referral drive", 20)]),
    mkPlan("follow-ups", "Follow-ups — Q3", [appr("followup_drive", "Follow-up drive", 100)]),
    mkPlan("communication", "Engagement — Q3", [appr("message_blast", "Reactivation blasts", 3)]),
    mkPlan("retention", "Retention — Q3", [appr("reactivation_drive", "Reactivation drive", 30)]),
    mkPlan("organizations", "Partnerships — Q3", [appr("engagement_plan", "Engagement plan", 12)]),
    // Company business plan (SAEC): governs centres without their own plan.
    mkPlan("leads", "SAEC — Lead Generation FY Plan", [appr("generate_leads", "Network-wide lead programme", 300)], 6000000, [
      { kpiLabel: "New leads", label: "New leads", target: 300, unit: "" },
      { kpiLabel: "Converted", label: "Converted", target: 60, unit: "" },
    ], { companyId: "co-saec" }),
    // Centre-scoped plans (per-centre planning demo): each centre plans separately.
    mkPlan("leads", "Chennai — Leads Q3", [appr("generate_leads", "Chennai lead drive", 40)], 1200000, [
      { kpiLabel: "New leads", label: "New leads", target: 40, unit: "" },
      { kpiLabel: "Converted", label: "Converted", target: 8, unit: "" },
    ], { branchId: "br-che", companyId: "co-saec" }),
    mkPlan("leads", "Ernakulam — Leads Q3", [appr("generate_leads", "Ernakulam lead drive", 60)], 1800000, [
      { kpiLabel: "New leads", label: "New leads", target: 60, unit: "" },
      { kpiLabel: "Converted", label: "Converted", target: 12, unit: "" },
    ], { branchId: "br-koc", companyId: "co-saec" }),
    mkPlan("camps", "Ernakulam — Camps Q3", [appr("conduct_camp", "Conduct 2 district camps", 2)], 3000000, [
      { kpiLabel: "All camps", label: "Camps", target: 2, unit: "" },
    ], { branchId: "br-koc", companyId: "co-saec" }),
  ];

  // ---- Activity catalogue (reverse planning): per-unit expected return + cost ----
  const activityMasters: Row[] = [
    { id: "am-camp", name: "Eye screening camp", moduleSlug: "camps", expectedValue: 20000_00, expectedCost: 8000_00, description: "One-day community screening camp", active: true, createdAt: day(-50) },
    { id: "am-mobile", name: "Mobile clinic route", moduleSlug: "mobile-clinics", expectedValue: 12000_00, expectedCost: 5000_00, description: "One van route day", active: true, createdAt: day(-50) },
    { id: "am-leaddrive", name: "Festival lead drive", moduleSlug: "leads", expectedValue: 10000_00, expectedCost: 2500_00, description: "Seasonal lead-generation push", active: true, createdAt: day(-50) },
    { id: "am-react", name: "Reactivation call drive", moduleSlug: "retention", expectedValue: 6000_00, expectedCost: 1000_00, description: "Dormant-patient call drive", active: true, createdAt: day(-50) },
    { id: "am-blast", name: "WhatsApp engagement blast", moduleSlug: "communication", expectedValue: 4000_00, expectedCost: 800_00, description: "Broadcast to consented patients", active: true, createdAt: day(-50) },
    { id: "am-cme", name: "Referrer CME meet", moduleSlug: "referrals", expectedValue: 8000_00, expectedCost: 3000_00, description: "CME evening for referring doctors", active: true, createdAt: day(-50) },
  ];

  // ---- Master plans: the budgetary vision statements (group + per company) ----
  const planYear = today.getUTCFullYear();
  const masterPlans: Row[] = [
    {
      id: "mp-group", year: planYear, companyId: null,
      targetValue: 1570000_00, // the targeted figure entered first; lines below allot it fully
      title: `Sreedhareeyam Group — Vision ${planYear}`,
      vision: "Grow the group's patient-relations business with dignified Ayurvedic care: every department plans from this vision, every centre owns its share, and follow-through is measured quarter by quarter.",
      ownerId: "stf-grouphead",
      lines: [
        { moduleSlug: "leads", yearlyValue: 200000_00, yearlyTarget: 800, kpiLabel: "New leads", quarters: { q1: 40000_00, q2: 50000_00, q3: 50000_00, q4: 60000_00 }, note: "Festival quarters heavier" },
        { moduleSlug: "appointments", yearlyValue: 150000_00, yearlyTarget: null, kpiLabel: null, quarters: null },
        { moduleSlug: "consultations", yearlyValue: 300000_00, yearlyTarget: null, kpiLabel: null, quarters: null },
        { moduleSlug: "camps", yearlyValue: 480000_00, yearlyTarget: 24, kpiLabel: "All camps", quarters: { q1: 90000_00, q2: 110000_00, q3: 120000_00, q4: 160000_00 } },
        { moduleSlug: "retention", yearlyValue: 120000_00, yearlyTarget: null, kpiLabel: null, quarters: null },
        { moduleSlug: "campaigns", yearlyValue: 320000_00, yearlyTarget: null, kpiLabel: null, quarters: null },
      ],
      // Reverse plan: the activities expected to achieve the worth.
      activities: [
        { id: "mp-act-1", activityMasterId: "am-camp", moduleSlug: "camps", name: "Eye screening camp", count: 24, expectedValue: 480000_00, expectedCost: 192000_00, quarter: null },
        { id: "mp-act-2", activityMasterId: "am-leaddrive", moduleSlug: "leads", name: "Festival lead drive", count: 12, expectedValue: 120000_00, expectedCost: 30000_00, quarter: null },
        { id: "mp-act-3", activityMasterId: "am-react", moduleSlug: "retention", name: "Reactivation call drive", count: 12, expectedValue: 72000_00, expectedCost: 12000_00, quarter: null },
        { id: "mp-act-4", activityMasterId: "am-blast", moduleSlug: "communication", name: "WhatsApp engagement blast", count: 6, expectedValue: 24000_00, expectedCost: 4800_00, quarter: "Q2" },
        { id: "mp-act-5", activityMasterId: "am-cme", moduleSlug: "referrals", name: "Referrer CME meet", count: 4, expectedValue: 32000_00, expectedCost: 12000_00, quarter: null },
      ],
      createdAt: day(-40), updatedAt: day(-5),
    },
    {
      id: "mp-saec", year: planYear, companyId: "co-saec",
      targetValue: 300000_00,
      title: `SAEC — Vision ${planYear}`,
      vision: "Each hospital and OP centre is a cost centre: plan your share of the network's growth in leads, outreach and retention.",
      ownerId: "stf-saecmgr",
      lines: [
        { moduleSlug: "leads", yearlyValue: 80000_00, yearlyTarget: 320, kpiLabel: "New leads", quarters: null },
        { moduleSlug: "camps", yearlyValue: 120000_00, yearlyTarget: 8, kpiLabel: "All camps", quarters: null },
        { moduleSlug: "retention", yearlyValue: 60000_00, yearlyTarget: null, kpiLabel: null, quarters: null },
        { moduleSlug: "follow-ups", yearlyValue: 40000_00, yearlyTarget: null, kpiLabel: null, quarters: null },
      ],
      createdAt: day(-35), updatedAt: day(-3),
    },
  ];

  // ---- Module configuration: per-module masters, custom records, plan configs ----
  const moduleMasters: Row[] = [
    {
      id: "mm-appt-venues", moduleSlug: "appointments", key: "clinic-venues", label: "Clinic Venue",
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "capacity", label: "Capacity", type: "number" },
        { name: "active", label: "Active", type: "boolean" },
      ],
      listColumns: ["name", "capacity", "active"], active: true,
    },
  ];
  const customRecords: Row[] = [
    { id: "cr-venue-1", moduleSlug: "appointments", masterKey: "clinic-venues", data: { name: "Town Hall (Kochi)", capacity: 120, active: true } },
    { id: "cr-venue-2", moduleSlug: "appointments", masterKey: "clinic-venues", data: { name: "Community Centre (Aluva)", capacity: 80, active: true } },
    { id: "cr-retention-rules", moduleSlug: "retention", masterKey: "retention-rules", data: { atRiskDays: 90, dormantDays: 180, lostDays: 365 }, createdAt: day(-30) },
  ];
  const planConfigs: Row[] = [
    {
      id: "pc-appt", moduleSlug: "appointments", cadence: "yearly", monthlyBudget: true,
      entryFields: [
        { name: "channel", label: "Channel", type: "select", options: [
          { value: "call_centre", label: "Call centre" }, { value: "front_desk", label: "Front desk" }, { value: "camp", label: "Camp" },
        ] },
      ],
      reportColumns: [{ name: "channel", label: "Channel", type: "text" }],
      flowSteps: [],
    },
    {
      id: "pc-leads", moduleSlug: "leads", cadence: "quarterly", monthlyBudget: false,
      entryFields: [], reportColumns: [], flowSteps: [],
    },
    {
      // Demo of a custom flow override (Configure → Flow): a trimmed follow-ups journey.
      id: "pc-followups", moduleSlug: "follow-ups", cadence: "monthly", monthlyBudget: false,
      entryFields: [], reportColumns: [],
      flowSteps: [
        { title: "Start: today's follow-ups", description: "Custom flow — work due tasks first.", kpiLabel: "Due today", href: "/follow-ups", actionLabel: "Open", icon: "bell" },
        { title: "Result: nothing overdue", description: "Custom flow — keep overdue at zero.", kpiLabel: "Overdue", href: "/follow-ups", actionLabel: "View", icon: "chart" },
      ],
    },
  ];

  // --- Ayurveda engagement: medicine courses + reminders, therapy plans + sessions ---
  const medicationCourses: Row[] = [
    { id: "mc-1", patientMrd: "MRD-1001", medicine: "Triphala Churna", durationDays: 30, startDate: day(-26), status: "active", adherence: "needs_refill", lastResponseAt: day(-2), notes: "Twice daily after food", createdAt: day(-26), updatedAt: day(-2) },
    { id: "mc-2", patientMrd: "MRD-1001", medicine: "Ashwagandha Tablets", durationDays: 45, startDate: day(-10), status: "active", adherence: "on_track", lastResponseAt: day(-1), notes: "One at bedtime", createdAt: day(-10), updatedAt: day(-1) },
    { id: "mc-3", patientMrd: "MRD-1002", medicine: "Kashayam (Maharasnadi)", durationDays: 21, startDate: day(-5), status: "active", adherence: "unknown", lastResponseAt: null, notes: null, cost: 4500_00, createdAt: day(-5), updatedAt: day(-5) },
    { id: "mc-4", patientMrd: "MRD-DORMANT1", medicine: "Netra Tarpana kit", durationDays: 30, startDate: day(-290), status: "completed", adherence: "on_track", lastResponseAt: day(-270), notes: "Last year course", cost: 7500_00, createdAt: day(-290), updatedAt: day(-270) },
  ];
  const medicationReminders: Row[] = [
    { id: "mr-1", courseId: "mc-1", patientMrd: "MRD-1001", kind: "start", dueDate: day(-26), status: "sent", sentAt: day(-26), createdAt: day(-26), updatedAt: day(-26) },
    { id: "mr-2", courseId: "mc-1", patientMrd: "MRD-1001", kind: "compliance", dueDate: day(-11), status: "sent", sentAt: day(-11), createdAt: day(-26), updatedAt: day(-11) },
    { id: "mr-3", courseId: "mc-1", patientMrd: "MRD-1001", kind: "refill", dueDate: day(2), status: "scheduled", sentAt: null, createdAt: day(-26), updatedAt: day(-26) },
    { id: "mr-4", courseId: "mc-2", patientMrd: "MRD-1001", kind: "start", dueDate: day(-10), status: "sent", sentAt: day(-10), createdAt: day(-10), updatedAt: day(-10) },
    { id: "mr-5", courseId: "mc-2", patientMrd: "MRD-1001", kind: "compliance", dueDate: day(12), status: "scheduled", sentAt: null, createdAt: day(-10), updatedAt: day(-10) },
    { id: "mr-6", courseId: "mc-2", patientMrd: "MRD-1001", kind: "refill", dueDate: day(26), status: "scheduled", sentAt: null, createdAt: day(-10), updatedAt: day(-10) },
    { id: "mr-7", courseId: "mc-3", patientMrd: "MRD-1002", kind: "start", dueDate: day(-5), status: "sent", sentAt: day(-5), createdAt: day(-5), updatedAt: day(-5) },
    { id: "mr-8", courseId: "mc-3", patientMrd: "MRD-1002", kind: "compliance", dueDate: day(5), status: "scheduled", sentAt: null, createdAt: day(-5), updatedAt: day(-5) },
    { id: "mr-9", courseId: "mc-3", patientMrd: "MRD-1002", kind: "refill", dueDate: day(12), status: "scheduled", sentAt: null, createdAt: day(-5), updatedAt: day(-5) },
  ];
  const therapyPlans: Row[] = [
    { id: "tp-1", patientMrd: "MRD-1001", therapyType: "panchakarma", name: "Panchakarma detox", totalSessions: 10, status: "in_progress", startDate: day(-21), notes: "Morning slot", createdAt: day(-21), updatedAt: day(-1) },
    { id: "tp-2", patientMrd: "MRD-1002", therapyType: "shirodhara", name: null, totalSessions: 7, status: "planned", startDate: day(2), notes: null, createdAt: day(-1), updatedAt: day(-1) },
    { id: "tp-3", patientMrd: "MRD-DORMANT1", therapyType: "panchakarma", name: "Panchakarma (last year)", totalSessions: 14, status: "completed", startDate: day(-300), notes: "Renewal recommended annually", cost: 50000_00, createdAt: day(-300), updatedAt: day(-280) },
  ];
  const therapySessions: Row[] = [
    ...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      // 7 completed, 1 missed (session 8), 2 scheduled — shows 7/10 + an amber miss.
      const status = n <= 7 ? "completed" : n === 8 ? "missed" : "scheduled";
      const sched = day(-21 + i * 2);
      return { id: `ts-1-${n}`, planId: "tp-1", patientMrd: "MRD-1001", sessionNo: n, scheduledDate: sched, status, completedAt: status === "completed" ? sched : null, notes: null, createdAt: day(-21), updatedAt: sched };
    }),
    ...Array.from({ length: 7 }, (_, i) => {
      const n = i + 1;
      return { id: `ts-2-${n}`, planId: "tp-2", patientMrd: "MRD-1002", sessionNo: n, scheduledDate: day(2 + i * 3), status: "scheduled", completedAt: null, notes: null, createdAt: day(-1), updatedAt: day(-1) };
    }),
  ];
  medicationCourses.forEach((c) => { c.patient = byId(patients, c.patientMrd, "mrd") ?? null; c.reminders = medicationReminders.filter((r) => r.courseId === c.id); });
  medicationReminders.forEach((r) => { r.patient = byId(patients, r.patientMrd, "mrd") ?? null; r.course = byId(medicationCourses, r.courseId) ?? null; });
  therapyPlans.forEach((p) => { p.patient = byId(patients, p.patientMrd, "mrd") ?? null; p.sessions = therapySessions.filter((s) => s.planId === p.id); });
  therapySessions.forEach((s) => { s.patient = byId(patients, s.patientMrd, "mrd") ?? null; s.plan = byId(therapyPlans, s.planId) ?? null; });
  patients.forEach((p) => {
    p.medicationCourses = medicationCourses.filter((c) => c.patientMrd === p.mrd);
    p.therapyPlans = therapyPlans.filter((t) => t.patientMrd === p.mrd);
  });

  const store: Record<string, Row[]> = {
    moduleMaster: moduleMasters, customRecord: customRecords, planConfig: planConfigs,
    medicationCourse: medicationCourses, medicationReminder: medicationReminders, therapyPlan: therapyPlans, therapySession: therapySessions,
    company: companies, branch: branches, designation: designations, department: departments, doctor: doctors, consultationRoom: consultationRooms,
    staffUser: staffUsers, leadSourceMaster: leadSources, diseaseMaster: diseases, serviceMaster: services,
    referralSourceMaster: referralSources, admissionPackageMaster: admissionPackages, followUpTypeMaster: followUpTypes,
    taskTypeMaster: taskTypes, reasonMaster: reasons, communicationTemplate: communicationTemplates,
    patient: patients, lead: leads, callLog: callLogs, opBooking: bookings, consultation: consultations,
    labReferral: labReferrals, treatmentPlan: treatmentPlans,
    admissionRecommendation: admissions, followUp: followUps, followUpActivity: followUpActivities, followUpEscalation: followUpEscalations, task: tasks, referral: referrals,
    referrer: referrers, referrerInteraction: referrerInteractions,
    communicationLog: communications, waitlistEntry: waitlist, retentionStatus, patientScore: patientScores, retentionActivity: retentionActivities, campaign: campaigns,
    organization: organizations, organizationEngagement: organizationEngagements, camp: camps, campPatient: campPatients, mobileClinic: mobileClinics,
    mobileClinicPatient: mobileClinicPatients, auditLog,
    leadActivity: leadActivities, leadAssignment: leadAssignments, campaignChannel: campaignChannels,
    appointmentStatusHistory, appointmentReminder: appointmentReminders, doctorLeave: doctorLeaves,
    doctorSchedule: doctorSchedules, timeSlot: timeSlots,
    marketingChannelMaster: marketingChannels, channelSeasonalOffer: channelSeasonalOffers,
    callChecklistItem: callChecklistItems, modulePlan: modulePlans, masterPlan: masterPlans, activityMaster: activityMasters,
  };
  return { store, counters: {} };
}

// Pin to globalThis so writes survive across requests / dev module re-eval.
const g = globalThis as unknown as { __PRM_MOCK__?: ReturnType<typeof buildStore> };
const cache = (g.__PRM_MOCK__ ??= buildStore());

/** The mutable store keyed by Prisma delegate name. Unlisted models default to []. */
export const store: Record<string, Record<string, any>[]> = cache.store;

/** Generate a stable-ish id for a newly created row of a model. */
export function nextId(model: string): string {
  cache.counters[model] = (cache.counters[model] ?? 0) + 1;
  return `${model}-new-${cache.counters[model]}`;
}

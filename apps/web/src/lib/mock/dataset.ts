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
  const branches: Row[] = [
    { id: "br-main", name: "Main Hospital", code: "MAIN", location: "Koothattukulam", active: true },
    { id: "br-koc", name: "Kochi Branch", code: "KOC", location: "Ernakulam", active: true },
  ];
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
  const doctors: Row[] = DOCTOR_DEFS.map(([key, name, role, dailyTarget, opDoctor], i) => ({ id: `doc-${key}`, name, role, designation: role ? ROLE_LABEL[role] : null, opDoctor, dailyTarget, registrationNo: `KMC-${2001 + i}`, active: true }));
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
  ];

  // --- Staff ---
  const staffUsers: Row[] = [
    { id: "stf-admin", name: "Admin User", email: "admin@sreedhareeyam.test", role: "administrator", branchId: branches[0].id, active: true },
    { id: "stf-callexec", name: "Call Exec", email: "callexec@sreedhareeyam.test", role: "call_center_executive", branchId: branches[0].id, active: true },
    { id: "stf-front", name: "Front Desk", email: "front@sreedhareeyam.test", role: "front_office", branchId: branches[0].id, active: true },
    { id: "stf-menon", name: "Dr. Menon", email: "menon@sreedhareeyam.test", role: "doctor", branchId: branches[0].id, active: true },
  ];

  // --- Patients ---
  const patients: Row[] = [
    { mrd: "MRD-1001", name: "Lakshmi Nair", phone: "9847012345", whatsapp: "9847012345", place: "Kochi", category: "repeat_patient", lifetimeVisits: 4, lifetimeRevenue: 480000, isNew: false, consentWhatsapp: true, consentSms: true, consentEmail: false, lastVisitDate: day(-20), createdAt: day(-200), updatedAt: day(-20) },
    { mrd: "MRD-1002", name: "Suresh Menon", phone: "9847022345", place: "Thrissur", category: "high_value", lifetimeVisits: 7, lifetimeRevenue: 1250000, isNew: false, consentWhatsapp: true, consentSms: false, consentEmail: false, lastVisitDate: day(-5), createdAt: day(-365), updatedAt: day(-5) },
    { mrd: "MRD-1003", name: "Anita George", phone: "9847032345", place: "Ernakulam", category: "new_patient", lifetimeVisits: 1, lifetimeRevenue: 30000, isNew: true, consentWhatsapp: true, consentSms: true, consentEmail: true, lastVisitDate: day(-2), createdAt: day(-30), updatedAt: day(-2) },
    { mrd: "MRD-DORMANT1", name: "Ravi Kumar", phone: "9847099001", place: "Thrissur", category: "dormant", lifetimeVisits: 3, lifetimeRevenue: 360000, isNew: false, consentWhatsapp: true, consentSms: false, consentEmail: false, lastVisitDate: day(-280), createdAt: day(-400), updatedAt: day(-280) },
    { mrd: "MRD-1005", name: "Fathima Rasheed", phone: "9847052345", place: "Malappuram", category: "at_risk", lifetimeVisits: 2, lifetimeRevenue: 90000, isNew: false, consentWhatsapp: false, consentSms: true, consentEmail: false, lastVisitDate: day(-120), createdAt: day(-150), updatedAt: day(-120) },
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
    bookings.push({
      id: `bk-slot-${i}`, bookingRef: `OP-1${String(i).padStart(3, "0")}`, patientMrd: demoPatients[i % demoPatients.length],
      doctorId: slot.doctorId, departmentId: oph, branchId: branches[0].id, roomId: slot.roomId, timeSlotId: slot.id,
      appointmentDate: today, startTime: slot.startTime, endTime: slot.endTime, status: opStatus, source: "call_centre",
      appointmentType: "regular", queueToken: 10 + i, bookedBy: "stf-callexec", bookedAt: day(-1),
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
    { id: "cons-1", bookingId: "bk-3", patientMrd: "MRD-1002", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[0].id, diseaseId: diseases[0].id, outcome: "admission_advised", diagnosis: "Bilateral cataract", advice: "Surgery recommended", notes: "Discuss package", createdAt: day(-5) },
  ];

  // --- Admissions ---
  const admissions: Row[] = [
    { id: "adm-1", patientMrd: "MRD-1002", consultationId: "cons-1", doctorId: doctors[1].id, packageId: admissionPackages[2].id, estimatedCost: 5000000, status: "counselled", createdAt: day(-5), updatedAt: day(-4) },
    { id: "adm-2", patientMrd: "MRD-1001", doctorId: doctors[0].id, packageId: admissionPackages[0].id, estimatedCost: 2500000, status: "admitted", createdAt: day(-25), updatedAt: day(-20) },
  ];

  // --- Follow-ups ---
  const followUps: Row[] = [
    { id: "fu-1", patientMrd: "MRD-1002", type: "admission", dueDate: day(-1), status: "pending", doctorId: doctors[1].id, ownerId: staffUsers[1].id, consultationId: "cons-1", desk: "front_office", createdAt: day(-5) },
    { id: "fu-2", patientMrd: "MRD-1003", type: "consultation_review", dueDate: today, status: "pending", ownerId: staffUsers[1].id, desk: "front_office", createdAt: day(-2) },
    { id: "fu-3", patientMrd: "MRD-1001", type: "medicine", dueDate: day(5), status: "booked", ownerId: staffUsers[1].id, desk: "front_office", createdAt: day(-2) },
    { id: "fu-4", patientMrd: "MRD-DORMANT1", type: "dormant_reactivation", dueDate: day(-10), status: "missed", ownerId: staffUsers[1].id, desk: "front_office", createdAt: day(-15) },
  ];

  // --- Tasks ---
  const tasks: Row[] = [
    { id: "task-1", type: "call_back_patient", subject: "Call back Meera Das", assigneeId: staffUsers[1].id, status: "open", priority: "high", dueDate: today, leadId: "lead-3", createdAt: day(-1) },
    { id: "task-2", type: "follow_up_admission", subject: "Admission follow-up Suresh", assigneeId: staffUsers[1].id, status: "in_progress", priority: "high", patientMrd: "MRD-1002", createdAt: day(-3) },
    { id: "task-3", type: "contact_dormant_patient", subject: "Reactivate Ravi Kumar", assigneeId: staffUsers[1].id, status: "open", priority: "medium", patientMrd: "MRD-DORMANT1", createdAt: day(-2) },
  ];

  // --- Referrals ---
  const referrals: Row[] = [
    { id: "ref-1", type: "patient_to_patient", status: "consulted", referrerPatientMrd: "MRD-1002", referredPatientMrd: "MRD-1003", revenue: 30000, createdAt: day(-15) },
    { id: "ref-2", type: "doctor", status: "pending", referrerName: "Dr. External", organizationId: "org-1", revenue: 0, createdAt: day(-6) },
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

  // --- Campaigns ---
  const campaigns: Row[] = [
    { id: "camp-1", name: "Cataract Awareness June", type: "facebook_ads", budget: 5000000, sourceId: leadSources[2].id, targetLocation: "Kochi", targetDistrict: "Ernakulam", targetDisease: "Cataract", targetAgeMin: 45, targetAgeMax: 75, targetGender: "all", targetAudience: "Seniors with blurred vision / cataract symptoms", status: "running", launchedAt: day(-3), active: true, createdAt: day(-30) },
    { id: "camp-2", name: "Diabetic Eye Camp", type: "camp", budget: 2000000, targetLocation: "Thrissur", targetDistrict: "Thrissur", targetDisease: "Diabetic retinopathy", targetAgeMin: 35, targetAgeMax: 70, targetGender: "all", targetAudience: "Known diabetics, retinopathy screening", status: "running", launchedAt: day(-1), active: true, createdAt: day(-15) },
    { id: "camp-3", name: "Glaucoma Screening Drive (planning)", type: "google_ads", budget: 3000000, sourceId: leadSources[2].id, targetLocation: "Kozhikode", targetDistrict: "Kozhikode", targetDisease: "Glaucoma", targetAgeMin: 50, targetAgeMax: 80, targetGender: "all", targetAudience: "Seniors with family history of glaucoma", status: "planned", launchedAt: null, active: true, createdAt: day(-2) },
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
    { id: "cmp-1", name: "Eye Camp Koothattukulam", location: "Koothattukulam", organizerId: "org-1", status: "completed", revenue: 150000, createdAt: day(-20) },
    { id: "cmp-2", name: "Vision Screening Kochi", location: "Ernakulam", organizerId: null, status: "planned", revenue: 0, createdAt: day(-3) },
  ];
  const campPatients: Row[] = [
    { id: "cp-1", campId: "cmp-1", contactName: "Ramesh", phone: "9847090001", complaint: "Blurred vision", recommendedVisit: true, createdAt: day(-20) },
    { id: "cp-2", campId: "cmp-1", contactName: "Geetha", phone: "9847090002", complaint: "Itchy eyes", recommendedVisit: false, createdAt: day(-20) },
  ];
  const mobileClinics: Row[] = [
    { id: "mc-1", routeName: "Route A — Idukki", location: "Idukki", status: "completed", createdAt: day(-18) },
  ];
  const mobileClinicPatients: Row[] = [
    { id: "mcp-1", mobileClinicId: "mc-1", contactName: "Joy", phone: "9847091001", complaint: "Cataract suspected", referredToBranch: true, createdAt: day(-18) },
  ];

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
  });
  admissions.forEach((a) => { a.patient = byId(patients, a.patientMrd, "mrd"); a.package = byId(admissionPackages, a.packageId) ?? null; });
  followUps.forEach((f) => { f.patient = byId(patients, f.patientMrd, "mrd"); f.doctor = byId(doctors, f.doctorId) ?? null; });
  tasks.forEach((t) => { t.assignee = byId(staffUsers, t.assigneeId) ?? null; t.lead = byId(leads, t.leadId) ?? null; });
  referrals.forEach((r) => {
    r.referrerPatient = r.referrerPatientMrd ? patientMini(r.referrerPatientMrd) : null;
    r.referredPatient = r.referredPatientMrd ? patientMini(r.referredPatientMrd) : null;
    r.organization = byId(organizations, r.organizationId) ?? null;
  });
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
  });

  const store: Record<string, Row[]> = {
    branch: branches, department: departments, doctor: doctors, consultationRoom: consultationRooms,
    staffUser: staffUsers, leadSourceMaster: leadSources, diseaseMaster: diseases, serviceMaster: services,
    referralSourceMaster: referralSources, admissionPackageMaster: admissionPackages, followUpTypeMaster: followUpTypes,
    taskTypeMaster: taskTypes, reasonMaster: reasons, communicationTemplate: communicationTemplates,
    patient: patients, lead: leads, callLog: callLogs, opBooking: bookings, consultation: consultations,
    admissionRecommendation: admissions, followUp: followUps, task: tasks, referral: referrals,
    communicationLog: communications, waitlistEntry: waitlist, retentionStatus, campaign: campaigns,
    organization: organizations, organizationEngagement: organizationEngagements, camp: camps, campPatient: campPatients, mobileClinic: mobileClinics,
    mobileClinicPatient: mobileClinicPatients, auditLog,
    leadActivity: leadActivities, leadAssignment: leadAssignments, campaignChannel: campaignChannels,
    appointmentStatusHistory, appointmentReminder: appointmentReminders, doctorLeave: doctorLeaves,
    doctorSchedule: doctorSchedules, timeSlot: timeSlots,
    marketingChannelMaster: marketingChannels, channelSeasonalOffer: channelSeasonalOffers,
    callChecklistItem: callChecklistItems,
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

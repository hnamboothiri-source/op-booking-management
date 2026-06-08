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
  const doctors: Row[] = [
    { id: "doc-menon", name: "Dr. Menon", designation: "Senior Consultant", registrationNo: "KMC-1001", dailyTarget: 20, active: true },
    { id: "doc-pillai", name: "Dr. Pillai", designation: "Consultant", registrationNo: "KMC-1002", dailyTarget: 15, active: true },
    { id: "doc-thomas", name: "Dr. Thomas", designation: "Medical Officer", registrationNo: "KMC-1003", dailyTarget: 25, active: true },
  ];
  const consultationRooms: Row[] = ["Room 1", "Room 2", "Room 3"].map((name, i) => ({ id: `room-${i}`, name, departmentId: departments[1].id, branchId: branches[0].id, active: true }));
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
  const reasons: Row[] = [["lost_lead", "Not interested"], ["lost_lead", "Chose another hospital"], ["no_show", "Forgot appointment"], ["admission_rejection", "Cost concern"], ["cancellation", "Patient rescheduled"]].map(([category, label], i) => ({ id: `rsn-${i}`, category, label, active: true }));
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
    { id: "lead-1", leadNumber: "LEAD-2026-000001", contactName: "Lakshmi Nair", phone: "9847012345", whatsapp: "9847012345", gender: "female", age: 58, city: "Kochi", district: "Ernakulam", chiefComplaint: "Blurred vision, cataract suspected", diseaseId: diseases[0].id, previousTreatment: false, existingPatient: false, stage: "new_lead", sourceId: leadSources[2].id, secondarySource: "website", priorityTier: "hot", ownerId: staffUsers[1].id, assignedAt: day(-3), branchId: branches[0].id, preferredDoctor: "Dr. Menon", followUpDate: day(-2), mergedIntoId: null, patientMrd: null, campaignId: "camp-1", desk: "back_office", createdAt: day(-3) },
    { id: "lead-2", leadNumber: "LEAD-2026-000002", contactName: "Joseph Mathew", phone: "9847062345", gender: "male", age: 45, city: "Thrissur", district: "Thrissur", chiefComplaint: "Dry eyes, irritation", diseaseId: diseases[2].id, previousTreatment: true, existingPatient: false, stage: "contacted", sourceId: leadSources[1].id, secondarySource: "google_ads", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(-6), branchId: branches[0].id, followUpDate: day(1), lastContactAt: day(-1), mergedIntoId: null, desk: "back_office", createdAt: day(-6) },
    { id: "lead-3", leadNumber: "LEAD-2026-000003", contactName: "Meera Das", phone: "9847072345", gender: "female", age: 62, city: "Kottayam", district: "Kottayam", chiefComplaint: "Glaucoma follow-up enquiry", diseaseId: diseases[1].id, previousTreatment: true, existingPatient: false, stage: "interested", sourceId: leadSources[0].id, secondarySource: "facebook", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(-8), branchId: branches[0].id, followUpDate: day(-1), lastContactAt: day(-2), mergedIntoId: null, desk: "back_office", createdAt: day(-8) },
    { id: "lead-4", leadNumber: "LEAD-2026-000004", contactName: "Anita George", phone: "9847032345", gender: "female", age: 50, city: "Kochi", district: "Ernakulam", chiefComplaint: "Cataract surgery enquiry", diseaseId: diseases[0].id, previousTreatment: false, existingPatient: true, stage: "appointment_booked", sourceId: leadSources[2].id, ownerId: staffUsers[1].id, assignedAt: day(-30), branchId: branches[0].id, patientMrd: "MRD-1003", lastContactAt: day(-28), mergedIntoId: null, desk: "back_office", createdAt: day(-30) },
    { id: "lead-5", leadNumber: "LEAD-2026-000005", contactName: "Vinod P", phone: "9847082345", gender: "male", age: 39, city: "Aluva", district: "Ernakulam", chiefComplaint: "General eye checkup", previousTreatment: false, existingPatient: false, stage: "not_reachable", sourceId: leadSources[3].id, priorityTier: "cold", ownerId: staffUsers[1].id, assignedAt: day(-10), branchId: branches[0].id, followUpDate: day(-4), lastContactAt: day(-7), mergedIntoId: null, desk: "reception", createdAt: day(-10) },
    { id: "lead-6", leadNumber: "LEAD-2026-000006", contactName: "Ann Mathai", phone: "9847060001", gender: "female", age: 47, city: "Perumbavoor", district: "Ernakulam", chiefComplaint: "Watering eyes", stage: "new_lead", sourceId: leadSources[3].id, priorityTier: "hot", ownerId: null, branchId: branches[0].id, mergedIntoId: null, desk: "reception", createdAt: day(0) },
    { id: "lead-7", leadNumber: "LEAD-2026-000007", contactName: "Bilal K", phone: "9847060002", whatsapp: "9847060002", gender: "male", age: 33, city: "Calicut", district: "Kozhikode", chiefComplaint: "Diabetic retinopathy screening", diseaseId: diseases[4].id, stage: "new_lead", sourceId: leadSources[4].id, secondarySource: "whatsapp", priorityTier: "warm", ownerId: staffUsers[1].id, assignedAt: day(0), branchId: branches[0].id, mergedIntoId: null, desk: "back_office", createdAt: day(0) },
  ];

  // --- Bookings ---
  const bookings: Row[] = [
    { id: "bk-1", bookingRef: "OP-0001", patientMrd: "MRD-1003", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, roomId: consultationRooms[0].id, appointmentDate: today, startTime: "10:30", status: "arrived", source: "online", bookedAt: day(-1), bookedBy: "stf-callexec", leadId: "lead-4" },
    { id: "bk-2", bookingRef: "OP-0002", patientMrd: "MRD-1001", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, appointmentDate: today, startTime: "11:00", status: "waiting", source: "front_desk", bookedAt: today, bookedBy: "stf-front" },
    { id: "bk-3", bookingRef: "OP-0003", patientMrd: "MRD-1002", doctorId: doctors[1].id, departmentId: departments[0].id, branchId: branches[0].id, appointmentDate: day(-5), startTime: "09:30", status: "completed", source: "call_centre", bookedAt: day(-6), bookedBy: "stf-callexec", completedAt: day(-5) },
    { id: "bk-4", bookingRef: "OP-0004", patientMrd: "MRD-1005", doctorId: doctors[2].id, departmentId: departments[0].id, branchId: branches[0].id, appointmentDate: day(3), startTime: "12:00", status: "booked", source: "follow_up", bookedAt: day(-1), bookedBy: "stf-callexec" },
    { id: "bk-5", bookingRef: "OP-0005", patientMrd: "MRD-1002", doctorId: doctors[0].id, departmentId: departments[1].id, branchId: branches[0].id, appointmentDate: day(-40), startTime: "10:00", status: "no_show", source: "call_centre", bookedAt: day(-42), bookedBy: "stf-callexec", cancellationReason: "Forgot appointment" },
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
    { id: "camp-1", name: "Cataract Awareness June", type: "facebook_ads", budget: 5000000, sourceId: leadSources[2].id, targetDisease: "Cataract", active: true, createdAt: day(-30) },
    { id: "camp-2", name: "Diabetic Eye Camp", type: "camp", budget: 2000000, targetDisease: "Diabetic retinopathy", active: true, createdAt: day(-15) },
  ];

  // --- Organizations / Camps / Mobile clinics ---
  const organizations: Row[] = [
    { id: "org-1", name: "St. Mary's School", type: "school", nextEngagement: day(14), contactPersons: [{ name: "Principal", role: "Head" }], createdAt: day(-90) },
    { id: "org-2", name: "Acme Corp", type: "company", nextEngagement: null, contactPersons: [], createdAt: day(-60) },
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
    b.room = byId(consultationRooms, b.roomId) ?? null;
    b.consultation = consultations.find((c) => c.bookingId === b.id) ?? null;
  });
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
    organization: organizations, camp: camps, campPatient: campPatients, mobileClinic: mobileClinics,
    mobileClinicPatient: mobileClinicPatients, auditLog,
    leadActivity: leadActivities, leadAssignment: leadAssignments,
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

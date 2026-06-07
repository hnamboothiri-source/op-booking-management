# Functional Specification — Sreedhareeyam PRM Platform

> Source of truth for **what the system must do**. Every item here traces directly to the
> *Master Software Development Document*. This file exists so that no requirement is lost as
> the codebase grows. Companion docs: data model in [DATA.md](./DATA.md); build sequencing in
> the approved plan.

**Vision.** A complete Patient Relationship Management system covering the full patient
lifecycle — first enquiry → consultation → treatment → admission → follow-up → retention →
referrals → long-term engagement. Not appointment software: a central platform for patient
**acquisition, conversion, clinical coordination, communication, and management reporting**.

**Lifecycle spine.**
`Lead → Appointment → Consultation → Referral/Test → Treatment/Admission → Follow-up → Retention → Referral → Lifetime Patient Relationship`

---

## Core goals (acceptance themes)

1. Capture every patient lead from all sources.
2. Improve enquiry→consultation conversion.
3. Improve consultation→treatment and →admission conversion.
4. Track patient referrals, doctor referrals, camps, branches, mobile clinics.
5. Build a complete 360° patient profile.
6. Automate follow-ups, reminders, engagement.
7. Give management real-time performance visibility.
8. Reduce manual tracking (Excel, phone registers, paper).
9. Create accountability across call centre, front office, doctors, branches, patient-success teams.
10. Scalable PRM that can later integrate with HMS, EMR, billing, pharmacy, lab, mobile apps.

---

## Patient acquisition sources (every lead is tagged with one)

Social media ads · Google Ads · website enquiries · phone calls · WhatsApp enquiries ·
email enquiries · doctor referrals · previously-treated-patient referrals · branch referrals ·
camps · mobile clinics · corporate programs · school/college screening programs ·
NGO / institutional partnerships · walk-in patients.

> Every patient **must** be linked to a source so management can track which channel produces
> real consultations, admissions, and revenue.

---

## Modules

Legend: each module lists **Features**, the **Status/Stage** enum(s), **Outcomes/Reasons**, and **Reports**.
Status values are authoritative — implement enums exactly as written.

### M1 — Lead Management
Capture and manage all enquiries before they become registered patients.

- **Features:** lead creation · lead source selection · campaign tagging · patient contact details ·
  disease/complaint category · preferred branch · preferred doctor · lead priority · lead owner
  assignment · call status · follow-up date · lead stage tracking · duplicate lead detection ·
  lead merging · lead transfer between staff · missed-enquiry tracking · lead closure reason.
- **Stages:** New lead · Contacted · Interested · Appointment suggested · Appointment booked ·
  Not reachable · Not interested · Converted to patient · Lost.
- **Reports:** leads by source · by campaign · by branch · by executive · lead conversion rate ·
  lost-lead reason analysis · pending follow-up report.

### M2 — Call Center Management
Convert enquiries into appointments and follow-up actions.

- **Features:** call-center dashboard · new-enquiry queue · pending-callback list · missed-call list ·
  patient search · call history · appointment booking · follow-up reminders · call-outcome recording ·
  escalation to senior staff · WhatsApp/SMS sending · auto task generation · call-recording
  integration (if available).
- **Call outcomes:** appointment booked · follow-up required · not reachable · call later ·
  asked for doctor details · asked for treatment cost · interested in branch visit ·
  interested in admission · not interested.
- **KPIs:** calls handled per executive · leads converted per executive · average response time ·
  follow-up completion rate · missed-call recovery rate.

### M3 — Appointment Management
Manage doctor appointments across the main hospital and branches. *(Foundation exists in DATA.md.)*

- **Features:** doctor calendar · branch-wise schedule · doctor availability · room allocation ·
  slot booking · appointment confirmation · rescheduling · cancellation · waiting list ·
  walk-in registration · no-show marking · appointment-reminder automation · doctor-wise
  patient-target tracking.
- **Status:** Booked · Confirmed · Arrived · Waiting · In consultation · Completed · Cancelled ·
  No-show · Rescheduled.
- **Reports:** doctor-wise appointments · branch-wise appointments · no-show report ·
  slot utilization · appointment conversion from leads · walk-in vs booked.

### M4 — Patient 360° Profile
One complete view of each patient.

- **Profile fields:** patient ID · name · age · gender · mobile · WhatsApp number · email ·
  address · location · language preference · occupation · family members · patient category ·
  first-visit source · lifetime visit count · lifetime revenue · referral history · medical history ·
  consultation history · admission history · follow-up history · communication history ·
  documents and reports.
- **Relationship indicators:** new · repeat · high-value · referred · referring · dormant ·
  at-risk · VIP.

### M5 — Consultation Workflow
Support the doctor consultation process and connect it to PRM tracking. *(Coordination, not full EMR.)*

- **Features:** patient queue · doctor dashboard · consultation notes · diagnosis · advice ·
  prescription (summary) · test recommendation · optometry referral · lab referral ·
  admission recommendation · follow-up recommendation · referral to another doctor ·
  treatment plan · doctor remarks for call centre/front office.
- **Outcomes:** medicine prescribed · test recommended · follow-up advised · admission advised ·
  surgery/procedure advised · referred to another department · no treatment required.
- **Reports:** doctor-wise consultation count · diagnosis-wise patients · doctor referral pattern ·
  admission-recommendation count · follow-up-recommendation count.

### M6 — Referral Management
Track all patient and doctor referrals.

- **Referral types:** patient-to-patient · doctor · hospital · branch · camp · corporate · institutional.
- **Features:** referrer profile · referred-patient mapping · referral source tracking ·
  referral conversion tracking · referral reward eligibility (if applicable) ·
  external-doctor relationship tracking · referral performance dashboard.
- **Reports:** top referring patients · top referring doctors · referral-to-consultation conversion ·
  referral-to-admission conversion · branch-wise referrals · revenue from referrals.

### M7 — Camp Management
Measure the real value of camps and outreach programs.

- **Features:** camp creation · location · organizer · date and time · doctors/staff assigned ·
  patients screened · complaints identified · patients recommended for hospital visit ·
  appointment booking from camp · follow-up tracking · conversion to consultation ·
  conversion to treatment/admission · revenue from camp patients.
- **Camp flow:** Camp planned → Patients screened → Leads created → Appointment booked →
  Consultation completed → Treatment/admission tracked → Revenue measured.
- **Reports:** camp-wise patients screened · camp-wise hospital visits · camp conversion rate ·
  revenue from each camp · staff performance in camps.

### M8 — Mobile Clinic Management
Track mobile-clinic activity and conversion.

- **Features:** route planning · location schedule · staff assignment · patients screened ·
  follow-up cases · referral to main hospital/branch · appointment booking · conversion tracking.
- **Reports:** route-wise patient count · location-wise conversion · mobile-clinic revenue impact ·
  follow-up pending from mobile clinic.

### M9 — Follow-up Management
Make sure patients do not drop out after consultation. *(Extends existing FollowUp entity.)*

- **Types:** consultation review · medicine follow-up · test follow-up · admission follow-up ·
  surgery/procedure follow-up · long-term treatment follow-up · annual checkup ·
  dormant-patient reactivation.
- **Features:** automatic follow-up task creation · follow-up owner assignment · due date ·
  priority · call outcome · WhatsApp/SMS reminder · escalation if overdue ·
  missed-follow-up tracking · reschedule option · closure reason.
- **Reports:** follow-up due today · overdue follow-ups · follow-up completed by executive ·
  missed-follow-up report · follow-up-to-visit conversion.

### M10 — Admission Conversion Management
Track patients advised admission and improve admission conversion.

- **Features:** admission recommendation by doctor · admission counselling status ·
  estimated package/cost · patient decision status · reason for rejection/postponement ·
  follow-up task for admission team · admission booking · admission completed · admission cancelled.
- **Status:** Recommended · Counselled · Interested · Postponed · Accepted · Admitted · Rejected · Lost.
- **Rejection reasons:** cost concern · family decision pending · seeking second opinion ·
  travel difficulty · fear of admission · treatment postponed · chose another hospital.
- **Reports:** doctor-wise admission recommendation · admission conversion rate ·
  pending admission follow-ups · lost-admission reasons · revenue loss from rejected admissions.

### M11 — Patient Engagement & Communication
Maintain a continuous relationship with patients.

- **Channels:** WhatsApp · SMS · email · phone call · mobile-app notification.
- **Automated messages:** appointment confirmation · appointment reminder · follow-up reminder ·
  medicine-course reminder · test reminder · admission-counselling reminder · birthday wishes ·
  festival greetings · health-awareness messages · camp announcements · annual-checkup reminders.
- **Features:** message templates · language selection · communication history · consent management ·
  bulk communication · campaign communication · delivery-status tracking.

### M12 — Patient Retention & Reactivation
Identify patients who may be lost and bring them back.

- **Categories:** active · follow-up pending · at-risk · dormant · lost · reactivated.
- **Retention rules:** no visit for 3 months · no visit for 6 months · no visit for 1 year ·
  missed follow-up · admission recommended but not admitted · treatment started but not completed.
- **Features:** retention score · patient risk score · auto reactivation task · reactivation campaign ·
  dormant-patient list · patient-success-executive assignment.
- **Reports:** dormant patients · reactivated patients · retention rate · repeat-visit rate ·
  patient lifetime value.

### M13 — Marketing Campaign Management
Measure marketing effectiveness.

- **Features:** campaign creation · campaign type · budget · source · start and end date ·
  target location · target disease/category · leads generated · consultations generated ·
  admissions generated · revenue generated.
- **Campaign types:** Facebook Ads · Google Ads · newspaper · TV · radio · WhatsApp campaign ·
  camp campaign · doctor-referral campaign · corporate campaign.
- **Reports:** cost per lead · cost per consultation · cost per admission · ROI by campaign ·
  best-performing location · best-performing disease segment.

### M14 — Corporate & Institutional Relationship Management
Manage relationships with organizations that can generate patients.

- **Entities:** companies · schools · colleges · NGOs · panchayats · religious institutions ·
  associations · senior-citizen groups.
- **Features:** organization profile · contact persons · camps conducted · patients generated ·
  follow-ups generated · revenue generated · relationship owner · next-engagement date.
- **Reports:** organization-wise performance · corporate-camp conversion · institutional revenue contribution.

### M15 — Task & Workflow Management
Ensure accountability across teams. *(Cross-cutting engine — built early.)*

- **Task types:** call back patient · confirm appointment · follow up admission · follow up test ·
  follow up medicine · contact dormant patient · camp follow-up · doctor-referral follow-up.
- **Features:** task assignment · due date · priority · status · remarks · escalation ·
  reassignment · completion tracking.
- **Status:** Open · In progress · Completed · Overdue · Cancelled · Escalated.

### M16 — User Roles & Access Control
*(Foundation — Phase 0.)*

- **Roles (15):** Administrator · Management · Call-center executive · Call-center manager ·
  Front office · Doctor · Optometry staff · Lab staff · Pharmacy staff · Admission counsellor ·
  Patient-success executive · Marketing team · Branch manager · Camp coordinator · Mobile-clinic coordinator.
- **Access rules:** each role sees only relevant data.
  - Doctors → assigned patients + clinical data.
  - Call centre → leads, appointments, follow-ups.
  - Management → dashboards and reports.
  - Branch users → only their branch unless permitted.
  - Admin → configure masters and user permissions.

---

## Dashboards

**Management:** total leads · total consultations · total admissions · lead conversion rate ·
consultation conversion rate · admission conversion rate · revenue by source · revenue by branch ·
doctor performance · campaign ROI · pending follow-ups · lost patients · dormant patients.

**Call Center:** new leads · pending calls · follow-ups due today · overdue follow-ups ·
appointments booked · conversion by executive.

**Doctor:** appointments today · patients waiting · consultations completed · tests referred ·
admissions recommended · follow-ups advised.

**Branch:** branch leads · branch appointments · branch consultations · branch revenue ·
branch follow-ups · branch conversion rate.

**Marketing:** campaign leads · cost per lead · cost per consultation · cost per admission ·
campaign revenue · ROI.

---

## Report library (§6)

- **Lead:** daily lead · source-wise · campaign-wise · lost lead · executive-wise conversion.
- **Appointment:** doctor-wise · branch-wise · no-show · cancelled appointment · slot utilization.
- **Consultation:** doctor-wise · diagnosis-wise · referral · follow-up advised · admission advised.
- **Follow-up:** due · overdue · completed · conversion.
- **Admission:** recommended · pending · conversion · lost-admission reason.
- **Camp:** camp patient · camp conversion · camp revenue.
- **Referral:** patient referral · doctor referral · branch referral · referral revenue.
- **Retention:** dormant patient · repeat patient · reactivated patient · patient lifetime value.

All reports filterable by date / branch / doctor / source and exportable to CSV/PDF.

---

## Master data (20 — admin-managed, Phase 0)

Branch · Doctor · Department · Consultation room · Staff · User role · Lead source · Campaign ·
Disease/complaint · Service · Referral source · Camp · Mobile-clinic route · Organization ·
Communication template · Follow-up type · Admission package · Appointment slot · Task type ·
**Reason master** (lost leads, no-shows, admission rejection, cancellations).

---

## Integrations

**Required:** WhatsApp Business API · SMS gateway · email service · call-center/IVR system ·
website enquiry form · Facebook/Meta lead forms · Google Ads lead tracking.

**Future:** HMS · EMR · billing · pharmacy · lab system · payment gateway · patient mobile app ·
Power BI / analytics platform.

---

## Automation rules

**Lead:** new website enquiry → create lead automatically · missed call → create callback task ·
duplicate mobile number → alert user · lead not contacted within defined time → escalate to manager.

**Appointment:** appointment confirmation sent automatically · reminder sent before appointment ·
no-show → create follow-up task.

**Follow-up:** doctor follow-up advice → create task · admission recommendation → create admission-
counselling task · missed follow-up → escalation · dormant patient → reactivation task.

**Campaign:** campaign source attached to lead · revenue from converted patient linked to campaign.

---

## Patient scoring

**Retention score factors:** +repeat visit · +follow-up completed · +referral given ·
−missed follow-up · −no visit for long period · −admission rejected.

**Conversion score factors:** serious complaint · doctor recommendation · previous treatment history ·
family interest · cost concern · distance from hospital · response to follow-up calls.

> Rule-based first; designed to later support AI-based patient prioritization (Phase 5).

---

## Success metrics (§15)

**Business:** ↑ enquiry→appointment · ↑ appointment→consultation · ↑ consultation→admission ·
↑ follow-up compliance · ↓ patient drop-off · ↑ campaign-ROI visibility · ↑ repeat visits · ↑ referral patients.

**Operational:** ↓ manual follow-up tracking · ↓ missed calls · ↑ doctor slot utilization ·
↑ branch-wise visibility · ↑ accountability of call centre and front office.

---

## MVP scope (§14)

**Must include:** lead capture · lead source tracking · call-centre follow-up · appointment booking ·
patient profile · doctor schedule · consultation-outcome tracking · admission-recommendation tracking ·
follow-up task management · basic dashboards.

**Avoid initially:** complex AI · full EMR replacement · advanced mobile app · deep billing
integration · complex loyalty/reward system.

---

## Implementation phases (§13) → module map

| Phase | Duration | Modules / deliverables |
|-------|----------|------------------------|
| **0 — Foundation** | ~2–3 wk | RBAC (M16), 20 masters, audit log, PII encryption, task engine (M15) core, scaffold, CI/CD |
| **1 — MVP** | 8–10 wk | M1 Lead · M2 Call Center · M3 Appointment · M4 basic profile · M9 follow-up tasks · basic reports · lead+appointment automation |
| **2 — Consultation & Referral** | 8–10 wk | M5 Consultation · Doctor dashboard · lab/optometry referral · M10 admission recommendation · prescription summary · doctor-wise reports |
| **3 — PRM Expansion** | 8–12 wk | M4 full 360 · M6 Referral · M7 Camp · M8 Mobile Clinic · M11 Engagement · M14 Corporate · WhatsApp/SMS, Meta/Google webhooks |
| **4 — Analytics** | 6–8 wk | Management dashboard · M13 Campaign ROI · branch/doctor performance · admission funnel · M12 Retention analytics · KPI rollups |
| **5 — Advanced** | 8–12 wk | AI scoring · predictive follow-up · Flutter mobile app · HMS/EMR integration · advanced automation · Power BI |

---

## Final principle

Build **PRM-first**, not as an HMS module. Core strength = relationship management, patient tracking,
conversion monitoring, follow-up automation. The platform must help Sreedhareeyam manage not only
treatment but also patient **acquisition, engagement, loyalty, and growth**.

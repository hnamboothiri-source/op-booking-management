-- CreateEnum
CREATE TYPE "Role" AS ENUM ('administrator', 'management', 'call_center_executive', 'call_center_manager', 'front_office', 'doctor', 'optometry_staff', 'lab_staff', 'pharmacy_staff', 'admission_counsellor', 'patient_success_executive', 'marketing_team', 'branch_manager', 'camp_coordinator', 'mobile_clinic_coordinator');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new_lead', 'contacted', 'interested', 'appointment_suggested', 'appointment_booked', 'not_reachable', 'not_interested', 'converted_to_patient', 'lost');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('appointment_booked', 'follow_up_required', 'not_reachable', 'call_later', 'asked_for_doctor_details', 'asked_for_treatment_cost', 'interested_in_branch_visit', 'interested_in_admission', 'not_interested');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('booked', 'confirmed', 'arrived', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show', 'rescheduled');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('call_centre', 'front_desk', 'enquiry', 'waitlist', 'follow_up', 'online', 'camp', 'mobile_clinic');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('open', 'full', 'blocked', 'cancelled');

-- CreateEnum
CREATE TYPE "PatientCategory" AS ENUM ('new_patient', 'repeat_patient', 'high_value', 'referred', 'referring', 'dormant', 'at_risk', 'vip');

-- CreateEnum
CREATE TYPE "ConsultationOutcome" AS ENUM ('medicine_prescribed', 'test_recommended', 'follow_up_advised', 'admission_advised', 'surgery_or_procedure_advised', 'referred_to_department', 'no_treatment_required');

-- CreateEnum
CREATE TYPE "ReferralType" AS ENUM ('patient_to_patient', 'doctor', 'hospital', 'branch', 'camp', 'corporate', 'institutional');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'consulted', 'admitted', 'lost');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('consultation_review', 'medicine', 'test', 'admission', 'surgery_procedure', 'long_term_treatment', 'annual_checkup', 'dormant_reactivation', 'ip_readmission');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'booked', 'done', 'overdue', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('recommended', 'counselled', 'interested', 'postponed', 'accepted', 'admitted', 'rejected', 'lost');

-- CreateEnum
CREATE TYPE "AdmissionRejectionReason" AS ENUM ('cost_concern', 'family_decision_pending', 'seeking_second_opinion', 'travel_difficulty', 'fear_of_admission', 'treatment_postponed', 'chose_another_hospital');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('whatsapp', 'sms', 'email', 'phone_call', 'app_notification');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "RetentionCategory" AS ENUM ('active', 'follow_up_pending', 'at_risk', 'dormant', 'lost', 'reactivated');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('facebook_ads', 'google_ads', 'newspaper', 'tv', 'radio', 'whatsapp', 'camp', 'doctor_referral', 'corporate');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('company', 'school', 'college', 'ngo', 'panchayat', 'religious_institution', 'association', 'senior_citizen_group');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('call_back_patient', 'confirm_appointment', 'follow_up_admission', 'follow_up_test', 'follow_up_medicine', 'contact_dormant_patient', 'camp_follow_up', 'doctor_referral_follow_up');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'completed', 'overdue', 'cancelled', 'escalated');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CampStatus" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('open', 'converted', 'closed', 'lost');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('waiting', 'promoted', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ReasonCategory" AS ENUM ('lost_lead', 'no_show', 'admission_rejection', 'cancellation');

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "location" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "registration_no" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT,
    "branch_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "consultation_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "branch_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diseases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "diseases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "referral_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FollowUpType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "follow_up_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimated_cost" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "admission_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reasons" (
    "id" TEXT NOT NULL,
    "category" "ReasonCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "day_of_week" INTEGER,
    "specific_date" DATE,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "slot_duration_minutes" INTEGER NOT NULL,
    "max_patients_per_slot" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_until" DATE,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "schedule_id" TEXT,
    "slot_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SlotStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "mrd" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "alternate_phone" TEXT,
    "email" TEXT,
    "place" TEXT,
    "address" TEXT,
    "gender" "Gender",
    "date_of_birth" DATE,
    "occupation" TEXT,
    "language_pref" TEXT,
    "is_new" BOOLEAN NOT NULL DEFAULT true,
    "first_visit_source" TEXT,
    "category" "PatientCategory" NOT NULL DEFAULT 'new_patient',
    "lifetime_visits" INTEGER NOT NULL DEFAULT 0,
    "lifetime_revenue" INTEGER NOT NULL DEFAULT 0,
    "last_visit_date" DATE,
    "consent_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "consent_sms" BOOLEAN NOT NULL DEFAULT false,
    "consent_email" BOOLEAN NOT NULL DEFAULT false,
    "his_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("mrd")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "phone" TEXT,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "patient_mrd" TEXT,
    "source_id" TEXT,
    "campaign_id" TEXT,
    "disease_id" TEXT,
    "branch_id" TEXT,
    "preferred_doctor" TEXT,
    "priority" "LeadPriority" NOT NULL DEFAULT 'medium',
    "owner_id" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'new_lead',
    "follow_up_date" DATE,
    "last_call_outcome" "CallOutcome",
    "closure_reason" TEXT,
    "merged_into_id" TEXT,
    "missed_enquiry" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "patient_mrd" TEXT,
    "executive_id" TEXT,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "duration_sec" INTEGER,
    "recording_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "mrd" TEXT,
    "department_id" TEXT,
    "preferred_date" DATE,
    "source" "BookingSource" NOT NULL DEFAULT 'front_desk',
    "handler" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "converted_booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "op_bookings" (
    "id" TEXT NOT NULL,
    "booking_ref" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "time_slot_id" TEXT,
    "lead_id" TEXT,
    "appointment_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'booked',
    "source" "BookingSource" NOT NULL,
    "booked_by" TEXT,
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "enquiry_id" TEXT,
    "waitlist_id" TEXT,
    "rescheduled_from_id" TEXT,

    CONSTRAINT "op_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "doctor_id" TEXT,
    "department_id" TEXT NOT NULL,
    "requested_date" DATE NOT NULL,
    "fallback_dates" DATE[],
    "fallback_department_ids" TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'waiting',
    "promoted_booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "disease_id" TEXT,
    "notes" TEXT,
    "diagnosis" TEXT,
    "advice" TEXT,
    "outcome" "ConsultationOutcome" NOT NULL,
    "staff_remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_referrals" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "test_name" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optometry_referrals" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "reason" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optometry_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "duration_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_recommendations" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "consultation_id" TEXT,
    "doctor_id" TEXT,
    "package_id" TEXT,
    "estimated_cost" INTEGER,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'recommended',
    "rejection_reason" "AdmissionRejectionReason",
    "counsellor_id" TEXT,
    "decision_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "type" "ReferralType" NOT NULL,
    "referrer_patient_mrd" TEXT,
    "referrer_name" TEXT,
    "organization_id" TEXT,
    "referred_patient_mrd" TEXT,
    "consultation_id" TEXT,
    "branch_id" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "reward_eligible" BOOLEAN NOT NULL DEFAULT false,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "department_id" TEXT,
    "doctor_id" TEXT,
    "consultation_id" TEXT,
    "origin_booking_id" TEXT,
    "linked_booking_id" TEXT,
    "type" "FollowUpType" NOT NULL,
    "due_date" DATE NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "owner_id" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "call_outcome" "CallOutcome",
    "closure_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "subject" TEXT NOT NULL,
    "assignee_id" TEXT,
    "patient_mrd" TEXT,
    "lead_id" TEXT,
    "follow_up_id" TEXT,
    "admission_rec_id" TEXT,
    "due_date" DATE,
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "remarks" TEXT,
    "escalated_to_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "template_id" TEXT,
    "campaign_id" TEXT,
    "to_address" TEXT NOT NULL,
    "body" TEXT,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL,
    "budget" INTEGER NOT NULL DEFAULT 0,
    "source_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "target_location" TEXT,
    "target_disease" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "contact_persons" JSONB,
    "relation_owner_id" TEXT,
    "next_engagement" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "organizer_id" TEXT,
    "coordinator_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" "CampStatus" NOT NULL DEFAULT 'planned',
    "staff_assigned" JSONB,
    "patients_screened" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camp_patients" (
    "id" TEXT NOT NULL,
    "camp_id" TEXT NOT NULL,
    "patient_mrd" TEXT,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT,
    "complaint" TEXT,
    "recommended_visit" BOOLEAN NOT NULL DEFAULT false,
    "booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "camp_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_clinics" (
    "id" TEXT NOT NULL,
    "route_name" TEXT NOT NULL,
    "location" TEXT,
    "coordinator_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" "CampStatus" NOT NULL DEFAULT 'planned',
    "patients_screened" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_clinic_patients" (
    "id" TEXT NOT NULL,
    "mobile_clinic_id" TEXT NOT NULL,
    "patient_mrd" TEXT,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT,
    "complaint" TEXT,
    "referred_to_branch" BOOLEAN NOT NULL DEFAULT false,
    "booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_clinic_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_scores" (
    "id" TEXT NOT NULL,
    "patient_mrd" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "factors" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_status" (
    "patient_mrd" TEXT NOT NULL,
    "category" "RetentionCategory" NOT NULL DEFAULT 'active',
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "success_owner_id" TEXT,
    "last_evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_status_pkey" PRIMARY KEY ("patient_mrd")
);

-- CreateTable
CREATE TABLE "patient_segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_kpi" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "branch_id" TEXT,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "appointments" INTEGER NOT NULL DEFAULT 0,
    "consultations" INTEGER NOT NULL DEFAULT 0,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_kpi" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "appointments" INTEGER NOT NULL DEFAULT 0,
    "consultations" INTEGER NOT NULL DEFAULT 0,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "branch_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_kpi" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "consultations" INTEGER NOT NULL DEFAULT 0,
    "admissions_recommended" INTEGER NOT NULL DEFAULT 0,
    "follow_ups_advised" INTEGER NOT NULL DEFAULT 0,
    "noShows" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "doctor_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_kpi" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "consultations" INTEGER NOT NULL DEFAULT 0,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "spend" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executive_kpi" (
    "id" TEXT NOT NULL,
    "executive_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "calls_handled" INTEGER NOT NULL DEFAULT 0,
    "leads_converted" INTEGER NOT NULL DEFAULT 0,
    "follow_ups_completed" INTEGER NOT NULL DEFAULT 0,
    "avg_response_sec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "executive_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branches_name_key" ON "branches"("name");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_registration_no_key" ON "doctors"("registration_no");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "staff_users_role_idx" ON "staff_users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_name_key" ON "lead_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "diseases_name_key" ON "diseases"("name");

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "referral_sources_name_key" ON "referral_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_types_name_key" ON "follow_up_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "admission_packages_name_key" ON "admission_packages"("name");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_name_key" ON "task_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "reasons_category_label_key" ON "reasons"("category", "label");

-- CreateIndex
CREATE INDEX "time_slots_slot_date_doctor_id_idx" ON "time_slots"("slot_date", "doctor_id");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_category_idx" ON "patients"("category");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_source_id_idx" ON "leads"("source_id");

-- CreateIndex
CREATE INDEX "leads_owner_id_idx" ON "leads"("owner_id");

-- CreateIndex
CREATE INDEX "call_logs_executive_id_created_at_idx" ON "call_logs"("executive_id", "created_at");

-- CreateIndex
CREATE INDEX "enquiries_status_created_at_idx" ON "enquiries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "op_bookings_booking_ref_key" ON "op_bookings"("booking_ref");

-- CreateIndex
CREATE INDEX "op_bookings_appointment_date_department_id_idx" ON "op_bookings"("appointment_date", "department_id");

-- CreateIndex
CREATE INDEX "op_bookings_doctor_id_appointment_date_idx" ON "op_bookings"("doctor_id", "appointment_date");

-- CreateIndex
CREATE INDEX "op_bookings_patient_mrd_idx" ON "op_bookings"("patient_mrd");

-- CreateIndex
CREATE INDEX "op_bookings_status_idx" ON "op_bookings"("status");

-- CreateIndex
CREATE INDEX "waitlist_entries_requested_date_department_id_status_idx" ON "waitlist_entries"("requested_date", "department_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_booking_id_key" ON "consultations"("booking_id");

-- CreateIndex
CREATE INDEX "consultations_doctor_id_created_at_idx" ON "consultations"("doctor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_plans_consultation_id_key" ON "treatment_plans"("consultation_id");

-- CreateIndex
CREATE INDEX "admission_recommendations_status_idx" ON "admission_recommendations"("status");

-- CreateIndex
CREATE INDEX "referrals_type_status_idx" ON "referrals"("type", "status");

-- CreateIndex
CREATE INDEX "follow_ups_due_date_status_idx" ON "follow_ups"("due_date", "status");

-- CreateIndex
CREATE INDEX "follow_ups_owner_id_idx" ON "follow_ups"("owner_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_idx" ON "tasks"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "tasks_due_date_status_idx" ON "tasks"("due_date", "status");

-- CreateIndex
CREATE INDEX "communication_logs_patient_mrd_idx" ON "communication_logs"("patient_mrd");

-- CreateIndex
CREATE INDEX "communication_logs_status_idx" ON "communication_logs"("status");

-- CreateIndex
CREATE INDEX "patient_scores_patient_mrd_kind_idx" ON "patient_scores"("patient_mrd", "kind");

-- CreateIndex
CREATE INDEX "retention_status_category_idx" ON "retention_status"("category");

-- CreateIndex
CREATE UNIQUE INDEX "patient_segments_name_key" ON "patient_segments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "daily_kpi_date_branch_id_key" ON "daily_kpi"("date", "branch_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "consultation_rooms" ADD CONSTRAINT "consultation_rooms_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "doctor_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "op_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "op_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_referrals" ADD CONSTRAINT "lab_referrals_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optometry_referrals" ADD CONSTRAINT "optometry_referrals_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_recommendations" ADD CONSTRAINT "admission_recommendations_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_recommendations" ADD CONSTRAINT "admission_recommendations_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_recommendations" ADD CONSTRAINT "admission_recommendations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "admission_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_patient_mrd_fkey" FOREIGN KEY ("referrer_patient_mrd") REFERENCES "patients"("mrd") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_patient_mrd_fkey" FOREIGN KEY ("referred_patient_mrd") REFERENCES "patients"("mrd") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_origin_booking_id_fkey" FOREIGN KEY ("origin_booking_id") REFERENCES "op_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_follow_up_id_fkey" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_admission_rec_id_fkey" FOREIGN KEY ("admission_rec_id") REFERENCES "admission_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camps" ADD CONSTRAINT "camps_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_patients" ADD CONSTRAINT "camp_patients_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camp_patients" ADD CONSTRAINT "camp_patients_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_clinic_patients" ADD CONSTRAINT "mobile_clinic_patients_mobile_clinic_id_fkey" FOREIGN KEY ("mobile_clinic_id") REFERENCES "mobile_clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_clinic_patients" ADD CONSTRAINT "mobile_clinic_patients_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_scores" ADD CONSTRAINT "patient_scores_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_status" ADD CONSTRAINT "retention_status_patient_mrd_fkey" FOREIGN KEY ("patient_mrd") REFERENCES "patients"("mrd") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

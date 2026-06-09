"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { occupiesSlot, type BookingStatus } from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Record a consultation against a booking (Module 5). Creates the chosen
 * downstream records (prescription summary, lab/optometry referral, treatment
 * plan, follow-up, admission recommendation), completes the booking, and fires
 * the relevant automations.
 */
export async function createConsultation(bookingId: string, fd: FormData): Promise<void> {
  const user = await requireCan("consultations", "create");
  const booking = await prisma.opBooking.findUnique({ where: { id: bookingId }, include: { patient: true } });
  if (!booking) throw new Error("Booking not found");

  const outcome = fd.get("outcome")?.toString() || "no_treatment_required";
  const prescriptionSummary = str(fd, "prescriptionSummary");
  const labTest = str(fd, "labTest");
  const optometryReason = str(fd, "optometryReason");
  const treatmentPlan = str(fd, "treatmentPlan");

  const consultation = await prisma.$transaction(async (tx) => {
    const c = await tx.consultation.create({
      data: {
        bookingId,
        patientMrd: booking.patientMrd,
        doctorId: booking.doctorId,
        departmentId: booking.departmentId,
        branchId: booking.branchId,
        diseaseId: str(fd, "diseaseId"),
        notes: str(fd, "notes"),
        diagnosis: str(fd, "diagnosis"),
        advice: str(fd, "advice"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outcome: outcome as any,
        bp: str(fd, "bp"),
        pulseBpm: num(fd, "pulseBpm"),
        weightKg: num(fd, "weightKg"),
        spo2: num(fd, "spo2"),
        staffRemarks: str(fd, "staffRemarks"),
        referredDepartmentId: str(fd, "referredDepartmentId"),
        referredDoctorId: str(fd, "referredDoctorId"),
      },
    });
    if (prescriptionSummary) await tx.prescription.create({ data: { consultationId: c.id, summary: prescriptionSummary } });
    if (labTest) await tx.labReferral.create({ data: { consultationId: c.id, testName: labTest } });
    if (optometryReason) await tx.optometryReferral.create({ data: { consultationId: c.id, reason: optometryReason } });
    if (treatmentPlan) await tx.treatmentPlan.create({ data: { consultationId: c.id, summary: treatmentPlan } });

    // Complete the booking if it is still in progress.
    if (occupiesSlot(booking.status as BookingStatus) && booking.status !== "completed") {
      await tx.opBooking.update({ where: { id: bookingId }, data: { status: "completed", completedAt: new Date() } });
      await tx.patient.update({
        where: { mrd: booking.patientMrd },
        data: { lifetimeVisits: { increment: 1 }, lastVisitDate: booking.appointmentDate, isNew: false },
      });
    }
    return c;
  });

  // Follow-up recommendation → FollowUp + task automation.
  const followUpDate = str(fd, "followUpDate");
  if (followUpDate) {
    await prisma.followUp.create({
      data: {
        patientMrd: booking.patientMrd,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (str(fd, "followUpType") as any) ?? "consultation_review",
        dueDate: new Date(followUpDate),
        doctorId: booking.doctorId,
        consultationId: consultation.id,
        originBookingId: bookingId,
        ownerId: user.id,
      },
    });
    await runAutomation("consultation_follow_up_advised", { patientMrd: booking.patientMrd, to: booking.patient.phone });
  }

  // Admission recommendation → record + counselling-task automation.
  if (fd.get("admissionRecommended") === "on") {
    const costRupees = str(fd, "estimatedCost");
    await prisma.admissionRecommendation.create({
      data: {
        patientMrd: booking.patientMrd,
        consultationId: consultation.id,
        doctorId: booking.doctorId,
        packageId: str(fd, "packageId"),
        estimatedCost: costRupees ? Math.round(parseFloat(costRupees) * 100) : null,
      },
    });
    await runAutomation("admission_recommended", { patientMrd: booking.patientMrd, to: booking.patient.phone });
  }

  await writeAudit({ actorId: user.id, action: "consultation.create", entity: "consultation", entityId: consultation.id, after: { outcome } });
  revalidatePath("/appointments");
  redirect(`/patients/${encodeURIComponent(booking.patientMrd)}`);
}

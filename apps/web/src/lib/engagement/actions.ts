"use server";

import { revalidatePath } from "next/cache";
import { renderTemplate, medicationCheckpoints, therapySessionDates, type Adherence, type TherapyType } from "@prm/core";
import type { Channel } from "@prm/integrations";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { deliver } from "../communication/actions";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const int = (fd: FormData, k: string, fallback = 0) => {
  const n = parseInt(str(fd, k) ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const revalidatePatient = (mrd: string) => revalidatePath(`/patients/${encodeURIComponent(mrd)}`);

// ------------------------------------------------------------- medicine adherence

/** Prescribe a medicine course and generate its reminder checkpoints. */
export async function prescribeMedicine(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("consultations", "create");
  const medicine = str(fd, "medicine");
  if (!medicine) throw new Error("Medicine name is required.");
  const durationDays = Math.max(1, int(fd, "durationDays", 30));
  const startISO = str(fd, "startDate") ?? todayISO();
  const course = await prisma.medicationCourse.create({
    data: {
      patientMrd, medicine, durationDays, startDate: new Date(startISO),
      notes: str(fd, "notes"), status: "active", adherence: "unknown",
    },
  });
  const checkpoints = medicationCheckpoints(startISO, durationDays);
  for (const cp of checkpoints) {
    await prisma.medicationReminder.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { courseId: course.id as string, patientMrd, kind: cp.kind as any, dueDate: new Date(cp.dueDate), status: "scheduled" },
    });
  }
  // A refill follow-up (Module 9) for the refill checkpoint so the desk chases medicine continuity.
  const refill = checkpoints.find((c) => c.kind === "refill") ?? checkpoints[checkpoints.length - 1];
  await prisma.followUp.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { patientMrd, type: "medicine" as any, dueDate: new Date(refill.dueDate), ownerId: user.id, desk: "front_office", notes: `Refill check · ${medicine}` },
  });
  await writeAudit({ actorId: user.id, action: "medicine.prescribe", entity: "medication_course", entityId: course.id as string, after: { patientMrd, medicine } });
  revalidatePatient(patientMrd);
}

/** Record the patient's adherence response on a course. */
export async function recordAdherence(courseId: string, patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("consultations", "edit");
  const adherence = (str(fd, "adherence") ?? "unknown") as Adherence;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.medicationCourse.update({ where: { id: courseId }, data: { adherence: adherence as any, lastResponseAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "medicine.adherence", entity: "medication_course", entityId: courseId, after: { adherence } });
  revalidatePatient(patientMrd);
}

export async function completeCourse(courseId: string, patientMrd: string): Promise<void> {
  const user = await requireCan("consultations", "edit");
  await prisma.medicationCourse.update({ where: { id: courseId }, data: { status: "completed" } });
  await writeAudit({ actorId: user.id, action: "medicine.complete", entity: "medication_course", entityId: courseId });
  revalidatePatient(patientMrd);
}

export async function discontinueCourse(courseId: string, patientMrd: string): Promise<void> {
  const user = await requireCan("consultations", "edit");
  await prisma.medicationCourse.update({ where: { id: courseId }, data: { status: "discontinued" } });
  await writeAudit({ actorId: user.id, action: "medicine.discontinue", entity: "medication_course", entityId: courseId });
  revalidatePatient(patientMrd);
}

/** Send a medicine reminder via the communication engine; marks it sent. */
export async function sendMedicineReminder(reminderId: string): Promise<void> {
  const user = await requireCan("communication", "create");
  const reminder = await prisma.medicationReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) throw new Error("Reminder not found.");
  const [course, patient, template] = await Promise.all([
    prisma.medicationCourse.findUnique({ where: { id: reminder.courseId as string } }),
    prisma.patient.findUnique({ where: { mrd: reminder.patientMrd as string } }),
    prisma.communicationTemplate.findFirst({ where: { name: "medicine_reminder" } }),
  ]);
  if (!patient) throw new Error("Patient not found.");
  const channel: Channel = patient.consentWhatsapp && (patient.whatsapp || patient.phone) ? "whatsapp" : patient.consentSms && patient.phone ? "sms" : "whatsapp";
  const to = (channel === "whatsapp" ? patient.whatsapp ?? patient.phone : patient.phone) ?? patient.phone;
  if (!to) throw new Error("No contact number for this patient.");
  const vars = { name: patient.name, first_name: patient.name.split(" ")[0], medicine: course?.medicine ?? "your medicine" };
  const body = renderTemplate(template?.body ?? "Hi {{first_name}}, a reminder about {{medicine}}.", vars);
  await deliver(channel, to, template?.name ?? "medicine_reminder", body, patient.mrd as string, template?.id as string ?? null);
  await prisma.medicationReminder.update({ where: { id: reminderId }, data: { status: "sent", sentAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "medicine.reminder.send", entity: "medication_reminder", entityId: reminderId, after: { channel } });
  revalidatePatient(patient.mrd as string);
  revalidatePath("/communication");
}

// ------------------------------------------------------------- therapy tracking

/** Create a therapy plan and generate its session rows. */
export async function createTherapyPlan(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("consultations", "create");
  const therapyType = (str(fd, "therapyType") ?? "panchakarma") as TherapyType;
  const totalSessions = Math.max(1, int(fd, "totalSessions", 1));
  const intervalDays = Math.max(1, int(fd, "intervalDays", 3));
  const startISO = str(fd, "startDate") ?? todayISO();
  const plan = await prisma.therapyPlan.create({
    data: {
      patientMrd,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      therapyType: therapyType as any, name: str(fd, "name"), totalSessions,
      startDate: new Date(startISO), notes: str(fd, "notes"), status: "planned",
    },
  });
  const dates = therapySessionDates(startISO, totalSessions, intervalDays);
  for (let i = 0; i < dates.length; i++) {
    await prisma.therapySession.create({
      data: { planId: plan.id as string, patientMrd, sessionNo: i + 1, scheduledDate: new Date(dates[i]), status: "scheduled" },
    });
  }
  await writeAudit({ actorId: user.id, action: "therapy.create", entity: "therapy_plan", entityId: plan.id as string, after: { patientMrd, therapyType, totalSessions } });
  revalidatePatient(patientMrd);
}

/** Mark a therapy session completed/missed/cancelled and roll up the plan status. */
export async function markSession(sessionId: string, status: "completed" | "missed" | "cancelled", patientMrd: string): Promise<void> {
  const user = await requireCan("consultations", "edit");
  const session = await prisma.therapySession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.therapySession.update({ where: { id: sessionId }, data: { status: status as any, completedAt: status === "completed" ? new Date() : null } });
  // Roll the plan: all-completed → completed; any-progress → in_progress.
  const siblings = await prisma.therapySession.findMany({ where: { planId: session.planId as string } });
  const done = siblings.filter((s) => s.status === "completed").length;
  const finished = siblings.every((s) => s.status === "completed" || s.status === "cancelled");
  const planStatus = finished && done > 0 ? "completed" : done > 0 ? "in_progress" : "planned";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.therapyPlan.update({ where: { id: session.planId as string }, data: { status: planStatus as any } });
  // A missed therapy session raises a therapy follow-up so the coordinator re-books it.
  if (status === "missed") {
    await prisma.followUp.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { patientMrd, type: "therapy" as any, dueDate: new Date(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)), ownerId: user.id, desk: "front_office", notes: `Missed therapy session #${session.sessionNo}` },
    });
  }
  await writeAudit({ actorId: user.id, action: "therapy.session", entity: "therapy_session", entityId: sessionId, after: { status, planStatus } });
  revalidatePatient(patientMrd);
}

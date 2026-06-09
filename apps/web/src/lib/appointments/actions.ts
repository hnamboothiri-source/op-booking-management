"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canTransitionBooking, releasesSlot, nextQueueToken, roomConflict, type BookingStatus,
} from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";
import { assertPlannedActivity } from "../planning/gate";
import { ensureSlotForBooking } from "./slots";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Next per-branch, per-day queue token (FRS §12). */
async function issueQueueToken(branchId: string | null, date: Date): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sameDay = await prisma.opBooking.findMany({ where: { branchId, appointmentDate: date, queueToken: { not: null } } as any, select: { queueToken: true } });
  return nextQueueToken(sameDay.map((b) => b.queueToken as number));
}

/** Append an appointment status-transition history row (best-effort). */
async function writeStatusHistory(bookingId: string, fromStatus: string | null, toStatus: string, reason: string | null, actorId: string) {
  try {
    await prisma.appointmentStatusHistory.create({ data: { bookingId, fromStatus, toStatus, reason, actorId } });
  } catch { /* history is non-critical */ }
}

/** Throw if `roomId` is already taken by an active booking at this date+time (FRS §7). */
async function assertRoomFree(roomId: string | null, date: Date, startTime: string, excludeId?: string) {
  if (!roomId) return;
  const others = await prisma.opBooking.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { roomId, appointmentDate: date, status: { notIn: ["cancelled", "rescheduled", "no_show"] }, ...(excludeId ? { id: { not: excludeId } } : {}) } as any,
    select: { startTime: true },
  });
  if (roomConflict(others, startTime)) throw new Error(`Room is already occupied at ${startTime} on ${date.toISOString().slice(0, 10)}`);
}

// --- Doctor schedule templates ---
export async function createSchedule(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
  await assertPlannedActivity("appointments", "doctor_schedule", str(fd, "planRef"));
  const doctorId = str(fd, "doctorId");
  const departmentId = str(fd, "departmentId");
  if (!doctorId || !departmentId) throw new Error("Doctor and department are required");
  const dow = str(fd, "dayOfWeek");
  const specific = str(fd, "specificDate");

  const created = await prisma.doctorSchedule.create({
    data: {
      doctorId,
      departmentId,
      branchId: str(fd, "branchId"),
      dayOfWeek: dow ? parseInt(dow, 10) : null,
      specificDate: specific ? new Date(specific) : null,
      startTime: str(fd, "startTime") ?? "09:00",
      endTime: str(fd, "endTime") ?? "12:00",
      slotDurationMinutes: parseInt(str(fd, "slotDurationMinutes") ?? "20", 10),
      maxPatientsPerSlot: parseInt(str(fd, "maxPatientsPerSlot") ?? "1", 10),
    },
  });
  await writeAudit({ actorId: user.id, action: "schedule.create", entity: "doctor_schedule", entityId: created.id });
  revalidatePath("/appointments/schedules");
  redirect("/appointments/schedules");
}

/**
 * Operational Room×Day grid edit — create or update a DoctorSchedule cell. Per the
 * OP-management decision, the weekly allotment is operational config editable
 * anytime, so this is NOT gated on a plan activity (unlike createSchedule).
 */
export async function saveScheduleSlot(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "edit");
  const id = str(fd, "id");
  const doctorId = str(fd, "doctorId");
  const departmentId = str(fd, "departmentId");
  if (!doctorId || !departmentId) throw new Error("Doctor and department are required");
  const dow = str(fd, "dayOfWeek");
  const data = {
    doctorId,
    departmentId,
    branchId: str(fd, "branchId"),
    roomId: str(fd, "roomId"),
    dayOfWeek: dow ? parseInt(dow, 10) : null,
    session: str(fd, "session"),
    weekOfMonth: str(fd, "weekOfMonth"),
    slotsCount: str(fd, "slotsCount") ? parseInt(str(fd, "slotsCount")!, 10) : null,
    startTime: str(fd, "startTime") ?? "09:00",
    endTime: str(fd, "endTime") ?? "13:00",
    slotDurationMinutes: parseInt(str(fd, "slotDurationMinutes") ?? "30", 10),
    maxPatientsPerSlot: parseInt(str(fd, "maxPatientsPerSlot") ?? "1", 10),
    active: true,
  };
  if (id) await prisma.doctorSchedule.update({ where: { id }, data });
  else await prisma.doctorSchedule.create({ data });
  await writeAudit({ actorId: user.id, action: id ? "schedule.grid.update" : "schedule.grid.create", entity: "doctor_schedule", entityId: id ?? doctorId });
  revalidatePath("/appointments/grid");
}

/** Operational — remove a schedule cell from the grid (ungated). */
export async function deleteSchedule(id: string): Promise<void> {
  const user = await requireCan("appointments", "edit");
  await prisma.doctorSchedule.update({ where: { id }, data: { active: false } });
  await writeAudit({ actorId: user.id, action: "schedule.grid.delete", entity: "doctor_schedule", entityId: id });
  revalidatePath("/appointments/grid");
}

// --- Doctor leave / emergency block ---
export async function createDoctorLeave(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
  const doctorId = str(fd, "doctorId");
  const fromStr = str(fd, "fromDate");
  const toStr = str(fd, "toDate") ?? fromStr;
  if (!doctorId || !fromStr) throw new Error("Doctor and from-date are required");
  const fromDate = new Date(fromStr); const toDate = new Date(toStr!);

  const leave = await prisma.doctorLeave.create({
    data: { doctorId, branchId: str(fd, "branchId"), fromDate, toDate, kind: str(fd, "kind") ?? "leave", reason: str(fd, "reason"), coverDoctorId: str(fd, "coverDoctorId") },
  });
  // Block any already-generated slots in the leave window.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.timeSlot.updateMany({ where: { doctorId, slotDate: { gte: fromDate, lte: toDate } } as any, data: { status: "blocked" } });
  await writeAudit({ actorId: user.id, action: "doctor.leave", entity: "doctor_leave", entityId: leave.id, after: { doctorId, fromStr, toStr } });
  revalidatePath("/appointments/schedules");
  redirect("/appointments/schedules");
}

// Slots are no longer pre-generated — the day's availability is derived live from the master
// weekly schedule (see lib/appointments/slots.ts: daySlots) and a TimeSlot row is materialised
// lazily on booking (ensureSlotForBooking). The old generateSlots action was removed.

// --- Booking ---
export async function createBooking(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
  const patientMrd = str(fd, "patientMrd");
  const doctorId = str(fd, "doctorId");
  const departmentId = str(fd, "departmentId");
  const dateStr = str(fd, "appointmentDate");
  const startTime = str(fd, "startTime");
  if (!patientMrd || !doctorId || !departmentId || !dateStr || !startTime) {
    throw new Error("Patient, doctor, department, date and time are required");
  }
  const timeSlotId = str(fd, "timeSlotId");
  const leadId = str(fd, "leadId");
  const source = str(fd, "source") ?? "call_centre";
  const roomId = str(fd, "roomId");
  const date = new Date(dateStr);
  await assertRoomFree(roomId, date, startTime);

  const count = await prisma.opBooking.count();
  const bookingRef = `OP-${date.getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;

  const created = await prisma.$transaction(async (tx) => {
    // Lazily materialise a slot from the master schedule when booking directly (no pre-generation).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slotId = timeSlotId ?? await ensureSlotForBooking(tx as any, { doctorId, departmentId, branchId: str(fd, "branchId"), roomId, date, startTime, endTime: str(fd, "endTime") });
    const b = await tx.opBooking.create({
      data: {
        bookingRef, patientMrd, doctorId, departmentId,
        branchId: str(fd, "branchId"),
        roomId,
        timeSlotId: slotId,
        appointmentType: str(fd, "appointmentType") ?? "regular",
        requestedDoctorId: str(fd, "requestedDoctorId"),
        noPreference: fd.get("noPreference") === "on",
        appointmentDate: date,
        startTime,
        endTime: str(fd, "endTime"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: source as any,
        bookedBy: user.id,
        leadId,
      },
    });
    if (slotId) {
      const slot = await tx.timeSlot.update({ where: { id: slotId }, data: { bookedCount: { increment: 1 } } });
      if (slot.bookedCount >= slot.capacity) await tx.timeSlot.update({ where: { id: slotId }, data: { status: "full" } });
    }
    if (leadId) await tx.lead.update({ where: { id: leadId }, data: { stage: "appointment_booked" } });
    return b;
  });

  // Automation: appointment confirmation (master doc §10).
  const patient = await prisma.patient.findUnique({ where: { mrd: patientMrd } });
  await runAutomation("appointment_created", { patientMrd, bookingId: created.id, to: patient?.phone });

  await writeAudit({ actorId: user.id, action: "booking.create", entity: "op_booking", entityId: created.id, after: { bookingRef } });
  revalidatePath("/appointments");
  redirect(`/appointments?date=${dateStr}`);
}

// --- Walk-in: register patient (if new) + same-day arrived booking ---
export async function walkInRegister(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
  const doctorId = str(fd, "doctorId");
  const departmentId = str(fd, "departmentId");
  const chiefComplaint = str(fd, "chiefComplaint");
  if (!doctorId || !departmentId) throw new Error("Doctor and department are required");
  if (!chiefComplaint) throw new Error("Chief complaint is required");

  let patientMrd = str(fd, "patientMrd");
  if (!patientMrd) {
    const name = str(fd, "name");
    if (!name) throw new Error("Patient name (or existing MRD) is required");
    patientMrd = `MRD-${Date.now().toString().slice(-8)}`;
    await prisma.patient.create({ data: { mrd: patientMrd, name, phone: str(fd, "phone"), place: str(fd, "place") } });
    await writeAudit({ actorId: user.id, action: "patient.create", entity: "patient", entityId: patientMrd, after: { name, walkIn: true } });
  }

  const today = new Date(new Date().toISOString().slice(0, 10));
  const startTime = str(fd, "startTime") ?? new Date().toTimeString().slice(0, 5);
  const roomId = str(fd, "roomId");
  await assertRoomFree(roomId, today, startTime);
  const count = await prisma.opBooking.count();
  const bookingRef = `OP-${today.getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;
  const branchId = str(fd, "branchId");
  const created = await prisma.opBooking.create({
    data: {
      bookingRef,
      patientMrd,
      doctorId,
      departmentId,
      branchId,
      roomId,
      appointmentDate: today,
      startTime,
      source: "front_desk",
      appointmentType: str(fd, "appointmentType") ?? "regular",
      requestedDoctorId: str(fd, "requestedDoctorId"),
      noPreference: fd.get("noPreference") === "on",
      status: "arrived",
      chiefComplaint,
      bp: str(fd, "bp"),
      pulseBpm: num(fd, "pulseBpm"),
      checkedInAt: new Date(),
      queueToken: await issueQueueToken(branchId, today),
      bookedBy: user.id,
    },
  });
  await writeAudit({ actorId: user.id, action: "booking.walkin", entity: "op_booking", entityId: created.id, after: { bookingRef } });
  revalidatePath("/appointments");
  revalidatePath("/queue");
  revalidatePath("/reception");
  redirect(`/queue`);
}

// --- Reschedule: new booking supersedes the old one ---
export async function rescheduleBooking(oldId: string, fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "edit");
  const old = await prisma.opBooking.findUnique({ where: { id: oldId } });
  if (!old) throw new Error("Original booking not found");

  const doctorId = str(fd, "doctorId");
  const departmentId = str(fd, "departmentId");
  const dateStr = str(fd, "appointmentDate");
  const startTime = str(fd, "startTime");
  if (!doctorId || !departmentId || !dateStr || !startTime) throw new Error("Doctor, department, date and time are required");
  const timeSlotId = str(fd, "timeSlotId");
  const reasonId = str(fd, "rescheduleReasonId");
  const reasonRow = reasonId ? await prisma.reasonMaster.findUnique({ where: { id: reasonId } }) : null;
  const reasonText = str(fd, "rescheduleReason") ?? reasonRow?.label ?? null;

  const count = await prisma.opBooking.count();
  const bookingRef = `OP-${new Date(dateStr).getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.opBooking.create({
      data: {
        bookingRef,
        patientMrd: old.patientMrd,
        doctorId,
        departmentId,
        branchId: str(fd, "branchId") ?? old.branchId,
        timeSlotId,
        appointmentType: str(fd, "appointmentType") ?? old.appointmentType ?? "regular",
        appointmentDate: new Date(dateStr),
        startTime,
        endTime: str(fd, "endTime"),
        source: old.source,
        bookedBy: user.id,
        rescheduledFromId: oldId,
      },
    });
    if (timeSlotId) {
      const slot = await tx.timeSlot.update({ where: { id: timeSlotId }, data: { bookedCount: { increment: 1 } } });
      if (slot.bookedCount >= slot.capacity) await tx.timeSlot.update({ where: { id: timeSlotId }, data: { status: "full" } });
    }
    // Supersede the old booking and free its slot.
    await tx.opBooking.update({ where: { id: oldId }, data: { status: "rescheduled", rescheduleReason: reasonText, rescheduleReasonId: reasonId } });
    if (old.timeSlotId) {
      const s = await tx.timeSlot.update({ where: { id: old.timeSlotId }, data: { bookedCount: { decrement: 1 } } });
      if (s.bookedCount < s.capacity && s.status === "full") await tx.timeSlot.update({ where: { id: old.timeSlotId }, data: { status: "open" } });
    }
    return fresh;
  });
  await writeStatusHistory(oldId, old.status as BookingStatus, "rescheduled", reasonText, user.id);
  await writeAudit({ actorId: user.id, action: "booking.reschedule", entity: "op_booking", entityId: oldId, after: { bookingRef, reason: reasonText } });
  revalidatePath("/appointments");
  redirect(`/appointments?date=${dateStr}`);
}

// --- Lifecycle transitions ---
export async function transitionBooking(id: string, to: BookingStatus): Promise<void> {
  const user = await requireCan("appointments", "edit");
  const b = await prisma.opBooking.findUnique({ where: { id } });
  if (!b) throw new Error("Booking not found");
  const from = b.status as BookingStatus;
  if (!canTransitionBooking(from, to)) throw new Error(`Illegal transition ${from} → ${to}`);

  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { status: to };
  if (to === "arrived") {
    data.checkedInAt = now;
    if (!b.queueToken) data.queueToken = await issueQueueToken(b.branchId, b.appointmentDate);
  }
  if (to === "completed") data.completedAt = now;
  if (to === "cancelled") data.cancelledAt = now;

  await prisma.$transaction(async (tx) => {
    await tx.opBooking.update({ where: { id }, data });
    if (releasesSlot(to) && b.timeSlotId) {
      const slot = await tx.timeSlot.update({ where: { id: b.timeSlotId }, data: { bookedCount: { decrement: 1 } } });
      if (slot.bookedCount < slot.capacity && slot.status === "full") {
        await tx.timeSlot.update({ where: { id: b.timeSlotId }, data: { status: "open" } });
      }
    }
    if (to === "completed") {
      await tx.patient.update({
        where: { mrd: b.patientMrd },
        data: { lifetimeVisits: { increment: 1 }, lastVisitDate: b.appointmentDate, isNew: false },
      });
    }
  });

  if (to === "no_show") await runAutomation("appointment_no_show", { patientMrd: b.patientMrd, bookingId: id });

  await writeStatusHistory(id, from, to, null, user.id);
  await writeAudit({ actorId: user.id, action: "booking.transition", entity: "op_booking", entityId: id, before: { status: from }, after: { status: to } });
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
}

/** Cancel a booking with a structured reason (FRS §10). Reason is kept; row not deleted. */
export async function cancelBooking(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "edit");
  const b = await prisma.opBooking.findUnique({ where: { id } });
  if (!b) throw new Error("Booking not found");
  const from = b.status as BookingStatus;
  if (!canTransitionBooking(from, "cancelled")) throw new Error(`Cannot cancel from ${from}`);
  const reasonId = str(fd, "cancellationReasonId");
  const reasonRow = reasonId ? await prisma.reasonMaster.findUnique({ where: { id: reasonId } }) : null;
  const reasonText = str(fd, "cancellationReason") ?? reasonRow?.label ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.opBooking.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date(), cancellationReason: reasonText, cancellationReasonId: reasonId } });
    if (b.timeSlotId) {
      const slot = await tx.timeSlot.update({ where: { id: b.timeSlotId }, data: { bookedCount: { decrement: 1 } } });
      if (slot.bookedCount < slot.capacity && slot.status === "full") await tx.timeSlot.update({ where: { id: b.timeSlotId }, data: { status: "open" } });
    }
  });
  await writeStatusHistory(id, from, "cancelled", reasonText, user.id);
  await writeAudit({ actorId: user.id, action: "booking.cancel", entity: "op_booking", entityId: id, before: { status: from }, after: { status: "cancelled", reason: reasonText } });
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canTransitionBooking, releasesSlot, generateSlotTimes, type BookingStatus,
} from "@prm/core";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";
import { runAutomation } from "../automation";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

// --- Doctor schedule templates ---
export async function createSchedule(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
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

// --- Slot generation for a date ---
export async function generateSlots(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
  const dateStr = str(fd, "date");
  if (!dateStr) throw new Error("Date is required");
  const date = new Date(dateStr);
  const dow = date.getUTCDay();

  const schedules = await prisma.doctorSchedule.findMany({
    where: { active: true, OR: [{ dayOfWeek: dow }, { specificDate: date }] },
  });

  let created = 0;
  for (const s of schedules) {
    for (const t of generateSlotTimes(s.startTime, s.endTime, s.slotDurationMinutes)) {
      const exists = await prisma.timeSlot.findFirst({ where: { doctorId: s.doctorId, slotDate: date, startTime: t.start } });
      if (exists) continue;
      await prisma.timeSlot.create({
        data: {
          doctorId: s.doctorId, departmentId: s.departmentId, branchId: s.branchId, scheduleId: s.id,
          slotDate: date, startTime: t.start, endTime: t.end, capacity: s.maxPatientsPerSlot, bookedCount: 0, status: "open",
        },
      });
      created++;
    }
  }
  await writeAudit({ actorId: user.id, action: "slots.generate", entity: "time_slot", after: { date: dateStr, created } });
  revalidatePath(`/appointments/schedules`);
  redirect(`/appointments/schedules?date=${dateStr}&generated=${created}`);
}

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

  const count = await prisma.opBooking.count();
  const bookingRef = `OP-${new Date(dateStr).getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;

  const created = await prisma.$transaction(async (tx) => {
    const b = await tx.opBooking.create({
      data: {
        bookingRef, patientMrd, doctorId, departmentId,
        branchId: str(fd, "branchId"),
        roomId: str(fd, "roomId"),
        timeSlotId,
        appointmentDate: new Date(dateStr),
        startTime,
        endTime: str(fd, "endTime"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: source as any,
        bookedBy: user.id,
        leadId,
      },
    });
    if (timeSlotId) {
      const slot = await tx.timeSlot.update({ where: { id: timeSlotId }, data: { bookedCount: { increment: 1 } } });
      if (slot.bookedCount >= slot.capacity) await tx.timeSlot.update({ where: { id: timeSlotId }, data: { status: "full" } });
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
  if (!doctorId || !departmentId) throw new Error("Doctor and department are required");

  let patientMrd = str(fd, "patientMrd");
  if (!patientMrd) {
    const name = str(fd, "name");
    if (!name) throw new Error("Patient name (or existing MRD) is required");
    patientMrd = `MRD-${Date.now().toString().slice(-8)}`;
    await prisma.patient.create({ data: { mrd: patientMrd, name, phone: str(fd, "phone"), place: str(fd, "place") } });
    await writeAudit({ actorId: user.id, action: "patient.create", entity: "patient", entityId: patientMrd, after: { name, walkIn: true } });
  }

  const today = new Date(new Date().toISOString().slice(0, 10));
  const count = await prisma.opBooking.count();
  const bookingRef = `OP-${today.getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;
  const created = await prisma.opBooking.create({
    data: {
      bookingRef,
      patientMrd,
      doctorId,
      departmentId,
      branchId: str(fd, "branchId"),
      roomId: str(fd, "roomId"),
      appointmentDate: today,
      startTime: str(fd, "startTime") ?? new Date().toTimeString().slice(0, 5),
      source: "front_desk",
      status: "arrived",
      checkedInAt: new Date(),
      bookedBy: user.id,
    },
  });
  await writeAudit({ actorId: user.id, action: "booking.walkin", entity: "op_booking", entityId: created.id, after: { bookingRef } });
  revalidatePath("/appointments");
  revalidatePath("/queue");
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
    await tx.opBooking.update({ where: { id: oldId }, data: { status: "rescheduled" } });
    if (old.timeSlotId) {
      const s = await tx.timeSlot.update({ where: { id: old.timeSlotId }, data: { bookedCount: { decrement: 1 } } });
      if (s.bookedCount < s.capacity && s.status === "full") await tx.timeSlot.update({ where: { id: old.timeSlotId }, data: { status: "open" } });
    }
    return fresh;
  });
  await writeAudit({ actorId: user.id, action: "booking.reschedule", entity: "op_booking", entityId: oldId, after: { bookingRef } });
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
  if (to === "arrived") data.checkedInAt = now;
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

  await writeAudit({ actorId: user.id, action: "booking.transition", entity: "op_booking", entityId: id, before: { status: from }, after: { status: to } });
  revalidatePath("/appointments");
}

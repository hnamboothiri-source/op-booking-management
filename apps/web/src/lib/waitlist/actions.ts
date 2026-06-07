"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)?.toString().trim();
  return v ? v : null;
};

export async function addToWaitlist(fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "create");
  const patientMrd = str(fd, "patientMrd");
  const departmentId = str(fd, "departmentId");
  const requestedDate = str(fd, "requestedDate");
  if (!patientMrd || !departmentId || !requestedDate) throw new Error("Patient, department and date are required");

  const created = await prisma.waitlistEntry.create({
    data: {
      patientMrd,
      departmentId,
      doctorId: str(fd, "doctorId"),
      requestedDate: new Date(requestedDate),
      priority: parseInt(str(fd, "priority") ?? "0", 10),
    },
  });
  await writeAudit({ actorId: user.id, action: "waitlist.add", entity: "waitlist_entry", entityId: created.id });
  revalidatePath("/waitlist");
  redirect("/waitlist");
}

export async function promoteWaitlist(id: string, fd: FormData): Promise<void> {
  const user = await requireCan("appointments", "edit");
  const entry = await prisma.waitlistEntry.findUnique({ where: { id } });
  if (!entry || entry.status !== "waiting") throw new Error("Entry not waiting");
  const doctorId = str(fd, "doctorId") ?? entry.doctorId;
  const startTime = str(fd, "startTime") ?? "10:00";
  if (!doctorId) throw new Error("Assign a doctor to promote");

  const count = await prisma.opBooking.count();
  const bookingRef = `OP-${entry.requestedDate.getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;

  const booking = await prisma.$transaction(async (tx) => {
    const b = await tx.opBooking.create({
      data: {
        bookingRef,
        patientMrd: entry.patientMrd,
        doctorId,
        departmentId: entry.departmentId,
        appointmentDate: entry.requestedDate,
        startTime,
        source: "waitlist",
        waitlistId: entry.id,
        bookedBy: user.id,
      },
    });
    await tx.waitlistEntry.update({ where: { id }, data: { status: "promoted", promotedBookingId: b.id } });
    return b;
  });
  await writeAudit({ actorId: user.id, action: "waitlist.promote", entity: "waitlist_entry", entityId: id, after: { bookingRef } });
  revalidatePath("/waitlist");
  revalidatePath("/appointments");
  redirect(`/appointments?date=${entry.requestedDate.toISOString().slice(0, 10)}`);
}

export async function cancelWaitlist(id: string): Promise<void> {
  const user = await requireCan("appointments", "edit");
  await prisma.waitlistEntry.update({ where: { id }, data: { status: "cancelled" } });
  await writeAudit({ actorId: user.id, action: "waitlist.cancel", entity: "waitlist_entry", entityId: id });
  revalidatePath("/waitlist");
}

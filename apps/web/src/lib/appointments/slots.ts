import { derivedDaySlots, type DerivedSlot } from "@prm/core";
import { prisma } from "../db";

const midnight = (s: string) => new Date(`${s}T00:00:00.000Z`);

export interface DaySlotCell extends DerivedSlot {
  booked: boolean;
  bookingId?: string;
  bookingStatus?: string;
  patientName?: string;
}
export interface DayDoctorCapacity {
  doctorId: string;
  substituteFor?: string | null;
  allotted: number;
  booked: number;
  roomId?: string | null;
  window?: string;
}

/**
 * The single source of a day's OP availability — derived LIVE from the master
 * weekly schedule (no pre-generation). On-leave doctors are reassigned to their
 * substitute. Bookings for the date are overlaid onto the derived slots.
 */
export async function daySlots(dateStr: string): Promise<{ cells: DaySlotCell[]; byDoctor: DayDoctorCapacity[] }> {
  const day = midnight(dateStr);
  const [schedules, leaves, bookings] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { active: true } }),
    prisma.doctorLeave.findMany(),
    prisma.opBooking.findMany({ where: { appointmentDate: day, status: { notIn: ["cancelled", "no_show", "rescheduled"] } }, include: { patient: true } }),
  ]);

  const derived = derivedDaySlots(schedules, dateStr, leaves);

  // Overlay bookings: consume one booking per (doctor,startTime), else any booking for that doctor.
  const remaining = [...bookings];
  const cells: DaySlotCell[] = derived.map((s) => {
    let i = remaining.findIndex((b) => b.doctorId === s.doctorId && b.startTime === s.startTime);
    if (i < 0) i = remaining.findIndex((b) => b.doctorId === s.doctorId);
    if (i >= 0) {
      const b = remaining.splice(i, 1)[0];
      return { ...s, booked: true, bookingId: b.id, bookingStatus: b.status, patientName: b.patient?.name };
    }
    return { ...s, booked: false };
  });

  const byDoctor: DayDoctorCapacity[] = [];
  const map = new Map<string, DayDoctorCapacity>();
  for (const c of cells) {
    let g = map.get(c.doctorId);
    if (!g) { g = { doctorId: c.doctorId, substituteFor: c.substituteFor, allotted: 0, booked: 0, roomId: c.roomId, window: c.startTime }; map.set(c.doctorId, g); byDoctor.push(g); }
    g.allotted += c.capacity;
    if (c.booked) g.booked += 1;
  }
  // Count any extra bookings (e.g. doctors with bookings but no derived slot today) so the board still shows them.
  for (const b of bookings) {
    if (!map.has(b.doctorId)) {
      const g = { doctorId: b.doctorId, allotted: 0, booked: 0, roomId: b.roomId, window: b.startTime };
      map.set(b.doctorId, g); byDoctor.push(g);
    }
  }
  return { cells, byDoctor };
}

/** Find-or-create the TimeSlot for a booking made directly against the master schedule (lazy materialisation). */
export async function ensureSlotForBooking(
  tx: { timeSlot: { findFirst: (a: unknown) => Promise<{ id: string } | null>; create: (a: unknown) => Promise<{ id: string }> } },
  o: { doctorId: string; departmentId: string; branchId?: string | null; roomId?: string | null; date: Date; startTime: string; endTime?: string | null; capacity?: number },
): Promise<string> {
  const existing = await tx.timeSlot.findFirst({ where: { doctorId: o.doctorId, slotDate: o.date, startTime: o.startTime } });
  if (existing) return existing.id;
  const created = await tx.timeSlot.create({
    data: {
      doctorId: o.doctorId, departmentId: o.departmentId, branchId: o.branchId ?? null, roomId: o.roomId ?? null,
      slotDate: o.date, startTime: o.startTime, endTime: o.endTime ?? o.startTime, capacity: o.capacity ?? 1, bookedCount: 0, status: "open",
    },
  });
  return created.id;
}

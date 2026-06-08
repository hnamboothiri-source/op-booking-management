/**
 * Executive performance funnel (Module 2 / §F). Computed live from the data
 * (the ExecutiveKPI rollup table is a backend job; we don't depend on it here).
 */
import { funnelRate } from "@prm/core";
import { prisma } from "@/lib/db";

const ARRIVED = ["arrived", "in_consultation", "completed"];
const CONVERTED = ["appointment_booked", "converted_to_patient"];

export interface ExecutiveFunnel {
  id: string;
  name: string;
  leads: number;
  calls: number;
  appointments: number;
  arrivals: number;
  followUpsDone: number;
  lost: number;
  conversion: number; // appointments / leads
  arrivalRate: number; // arrivals / appointments
}

export async function executiveFunnel(execId: string, name: string): Promise<ExecutiveFunnel> {
  const [leads, calls, appointments, arrivals, followUpsDone, lost, converted] = await Promise.all([
    prisma.lead.count({ where: { ownerId: execId, mergedIntoId: null } }),
    prisma.callLog.count({ where: { executiveId: execId } }),
    prisma.opBooking.count({ where: { bookedBy: execId } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.count({ where: { bookedBy: execId, status: { in: ARRIVED as any } } }),
    prisma.followUp.count({ where: { ownerId: execId, status: "done" } }),
    prisma.lead.count({ where: { ownerId: execId, stage: "lost" } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.lead.count({ where: { ownerId: execId, stage: { in: CONVERTED as any } } }),
  ]);
  return {
    id: execId,
    name,
    leads,
    calls,
    appointments,
    arrivals,
    followUpsDone,
    lost,
    conversion: funnelRate(converted, leads),
    arrivalRate: funnelRate(arrivals, appointments),
  };
}

/** Funnels for every executive who owns leads, logged calls, or booked appointments. */
export async function allExecutiveFunnels(): Promise<ExecutiveFunnel[]> {
  const [leadOwners, callExecs, bookers, staff] = await Promise.all([
    prisma.lead.findMany({ where: { ownerId: { not: null } }, select: { ownerId: true } }),
    prisma.callLog.findMany({ where: { executiveId: { not: null } }, select: { executiveId: true } }),
    prisma.opBooking.findMany({ where: { bookedBy: { not: null } }, select: { bookedBy: true } }),
    prisma.staffUser.findMany({ select: { id: true, name: true } }),
  ]);
  const ids = new Set<string>();
  leadOwners.forEach((l) => l.ownerId && ids.add(l.ownerId));
  callExecs.forEach((c) => c.executiveId && ids.add(c.executiveId));
  bookers.forEach((b) => b.bookedBy && ids.add(b.bookedBy));
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "Unknown";

  const funnels = await Promise.all([...ids].map((id) => executiveFunnel(id, nameOf(id))));
  return funnels.sort((a, b) => b.conversion - a.conversion);
}

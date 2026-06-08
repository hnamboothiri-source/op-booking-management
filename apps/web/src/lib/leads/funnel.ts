/**
 * Lead conversion funnel (FRS §15) computed live from the mock store. Each
 * stage carries the drill entity/filters so the chart segments open the drawer.
 */
import { prisma } from "@/lib/db";
import type { FunnelStage } from "@/components/charts/LeadFunnelChart";

const PROGRESSED = "contacted,interested,appointment_suggested,appointment_booked,converted_to_patient";
const INTERESTED = "interested,appointment_suggested,appointment_booked,converted_to_patient";
const BOOKED = "appointment_booked,converted_to_patient";

export async function leadFunnel(scope: Record<string, unknown> = {}): Promise<FunnelStage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadWhere = (stages?: string) => ({ ...scope, mergedIntoId: null, ...(stages ? { stage: { in: stages.split(",") } } : {}) }) as any;

  const [total, progressed, interested, booked, consulted, converted] = await Promise.all([
    prisma.lead.count({ where: leadWhere() }),
    prisma.lead.count({ where: leadWhere(PROGRESSED) }),
    prisma.lead.count({ where: leadWhere(INTERESTED) }),
    prisma.lead.count({ where: leadWhere(BOOKED) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.opBooking.count({ where: { ...scope, status: "completed" } as any }),
    prisma.lead.count({ where: leadWhere("converted_to_patient") }),
  ]);

  return [
    { label: "Leads", value: total, entity: "leads", filters: {} },
    { label: "Contacted", value: progressed, entity: "leads", filters: { stage: PROGRESSED } },
    { label: "Interested", value: interested, entity: "leads", filters: { stage: INTERESTED } },
    { label: "Appointment booked", value: booked, entity: "leads", filters: { stage: BOOKED } },
    { label: "Consultation done", value: consulted, entity: "appointments", filters: { status: "completed" } },
    { label: "Converted", value: converted, entity: "leads", filters: { stage: "converted_to_patient" } },
  ];
}

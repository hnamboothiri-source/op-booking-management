import { buildPatientTimeline, type TimelineEvent } from "@prm/core";

/**
 * Frontend-phase placeholder. Produces a believable patient journey by running
 * sample source rows through the real `buildPatientTimeline`, so the UI is
 * exercised exactly as it will be once the Prisma loader replaces this.
 * TODO(backend): swap for getPatientTimeline(mrd) reading from the database.
 */
export function mockPatientTimeline(): TimelineEvent[] {
  const d = (iso: string) => new Date(iso);
  return buildPatientTimeline({
    leads: [
      { id: "L1", createdAt: d("2026-03-02T10:15:00Z"), stage: "appointment_booked", sourceName: "Google Ads" },
    ],
    calls: [
      { id: "C1", createdAt: d("2026-03-02T09:40:00Z"), outcome: "appointment_booked", durationSec: 240, notes: "Booked for cataract evaluation" },
      { id: "C2", createdAt: d("2026-03-19T11:05:00Z"), outcome: "follow_up_required", durationSec: 95 },
      { id: "C3", createdAt: d("2026-04-08T16:20:00Z"), outcome: "not_reachable", durationSec: 0 },
    ],
    bookings: [
      {
        id: "B1", bookedAt: d("2026-03-02T10:20:00Z"), appointmentDate: d("2026-03-10T00:00:00Z"),
        startTime: "10:30", status: "completed", doctorName: "Dr. Menon", departmentName: "Ophthalmology",
      },
      {
        id: "B2", bookedAt: d("2026-03-19T11:10:00Z"), appointmentDate: d("2026-03-25T00:00:00Z"),
        startTime: "09:00", status: "cancelled", doctorName: "Dr. Menon", departmentName: "Ophthalmology",
        cancelledAt: d("2026-03-24T18:30:00Z"), cancellationReason: "Patient travelling",
      },
      {
        id: "B3", bookedAt: d("2026-04-08T16:25:00Z"), appointmentDate: d("2026-04-15T00:00:00Z"),
        startTime: "11:15", status: "confirmed", doctorName: "Dr. Nair", departmentName: "Retina",
      },
    ],
    consultations: [
      { id: "CO1", createdAt: d("2026-03-10T11:05:00Z"), outcome: "surgery_or_procedure_advised", doctorName: "Dr. Menon", diagnosis: "Senile cataract, both eyes" },
    ],
    admissions: [
      { id: "A1", createdAt: d("2026-03-10T11:30:00Z"), status: "counselled", packageName: "Phaco + IOL (bilateral)", estimatedCost: 6500000 },
    ],
    followUps: [
      { id: "F1", createdAt: d("2026-03-10T11:35:00Z"), type: "surgery_procedure", status: "pending", dueDate: d("2026-04-15T00:00:00Z") },
      { id: "F2", createdAt: d("2026-03-12T08:00:00Z"), type: "consultation_review", status: "done", dueDate: d("2026-03-18T00:00:00Z") },
    ],
    communications: [
      { id: "M1", createdAt: d("2026-03-02T10:25:00Z"), sentAt: d("2026-03-02T10:25:30Z"), channel: "whatsapp", status: "read", toAddress: "+91 98xxxxxx21" },
      { id: "M2", createdAt: d("2026-03-09T07:00:00Z"), sentAt: d("2026-03-09T07:00:10Z"), channel: "sms", status: "delivered", toAddress: "+91 98xxxxxx21" },
      { id: "M3", createdAt: d("2026-04-14T07:00:00Z"), channel: "whatsapp", status: "failed", toAddress: "+91 98xxxxxx21" },
    ],
    referrals: [
      { id: "R1", createdAt: d("2026-03-10T12:00:00Z"), type: "patient_to_patient", status: "consulted", direction: "given" },
    ],
    waitlist: [
      { id: "W1", createdAt: d("2026-04-08T16:30:00Z"), status: "waiting", requestedDate: d("2026-04-12T00:00:00Z"), departmentName: "Retina" },
    ],
    documents: [
      { id: "D1", uploadedAt: d("2026-03-10T13:00:00Z"), label: "OCT scan report" },
    ],
  });
}

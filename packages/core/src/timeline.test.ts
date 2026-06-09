import { describe, it, expect } from "vitest";
import { buildPatientTimeline, groupTimelineByDay, type TimelineSources } from "./timeline";

const D = (iso: string) => new Date(iso);

describe("buildPatientTimeline", () => {
  it("merges every source and sorts newest first", () => {
    const sources: TimelineSources = {
      bookings: [
        {
          id: "b1",
          bookedAt: D("2026-01-10T09:00:00Z"),
          appointmentDate: D("2026-01-15T00:00:00Z"),
          startTime: "10:30",
          status: "completed",
          doctorName: "Dr. Menon",
          departmentName: "Ophthalmology",
        },
      ],
      calls: [{ id: "c1", createdAt: D("2026-01-12T11:00:00Z"), outcome: "follow_up_required", durationSec: 180 }],
      consultations: [{ id: "co1", createdAt: D("2026-01-15T11:00:00Z"), outcome: "medicine_prescribed", doctorName: "Dr. Menon" }],
    };
    const tl = buildPatientTimeline(sources);
    expect(tl.map((e) => e.kind)).toEqual(["consultation", "call", "booking"]);
    expect(tl[0].at.toISOString()).toBe("2026-01-15T11:00:00.000Z");
  });

  it("emits a separate cancellation event with its own instant", () => {
    const tl = buildPatientTimeline({
      bookings: [
        {
          id: "b1",
          bookedAt: D("2026-02-01T08:00:00Z"),
          appointmentDate: D("2026-02-05T00:00:00Z"),
          startTime: "09:00",
          status: "cancelled",
          cancelledAt: D("2026-02-03T14:00:00Z"),
          cancellationReason: "patient travelling",
        },
      ],
    });
    expect(tl).toHaveLength(2);
    // newest first: the cancellation (Feb 3) precedes the booking (Feb 1)
    expect(tl[0].title).toBe("Appointment cancelled");
    expect(tl[0].tone).toBe("red");
    expect(tl[0].detail).toContain("travelling");
    expect(tl[1].title).toBe("Appointment booked");
  });

  it("tones follow-ups by status and surfaces the due date", () => {
    const tl = buildPatientTimeline({
      followUps: [
        { id: "f1", createdAt: D("2026-03-01T00:00:00Z"), type: "consultation_review", status: "pending", dueDate: D("2026-03-08T00:00:00Z") },
        { id: "f2", createdAt: D("2026-03-02T00:00:00Z"), type: "medicine", status: "done", dueDate: D("2026-03-09T00:00:00Z") },
      ],
    });
    const pending = tl.find((e) => e.id === "followup:f1")!;
    const done = tl.find((e) => e.id === "followup:f2")!;
    expect(pending.tone).toBe("amber");
    expect(pending.detail).toContain("due 2026-03-08");
    expect(done.tone).toBe("green");
  });

  it("breaks ties on equal instants deterministically by id", () => {
    const at = D("2026-04-01T10:00:00Z");
    const a = buildPatientTimeline({
      calls: [
        { id: "z", createdAt: at, outcome: "call_later" },
        { id: "a", createdAt: at, outcome: "call_later" },
      ],
    });
    const b = buildPatientTimeline({
      calls: [
        { id: "a", createdAt: at, outcome: "call_later" },
        { id: "z", createdAt: at, outcome: "call_later" },
      ],
    });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    expect(a[0].id).toBe("call:a");
  });

  it("returns an empty feed when there is no activity", () => {
    expect(buildPatientTimeline({})).toEqual([]);
  });

  it("maps medicine courses and therapy sessions", () => {
    const tl = buildPatientTimeline({
      medicationCourses: [{ id: "m1", createdAt: D("2026-06-01T09:00:00Z"), medicine: "Triphala", durationDays: 30 }],
      therapySessions: [
        { id: "s1", sessionNo: 3, scheduledDate: D("2026-06-10T00:00:00Z"), completedAt: D("2026-06-10T05:00:00Z"), status: "completed", therapyLabel: "Panchakarma" },
        { id: "s2", sessionNo: 4, scheduledDate: D("2026-06-13T00:00:00Z"), completedAt: null, status: "missed", therapyLabel: "Panchakarma" },
      ],
    });
    const med = tl.find((e) => e.id === "medicine:m1")!;
    expect(med.kind).toBe("medicine");
    expect(med.title).toBe("Medicine prescribed");
    expect(med.detail).toContain("Triphala");
    expect(med.tone).toBe("blue");
    const done = tl.find((e) => e.id === "therapy:s1")!;
    expect(done.tone).toBe("green");
    expect(done.title).toContain("session 3");
    const missed = tl.find((e) => e.id === "therapy:s2")!;
    expect(missed.tone).toBe("amber");
    expect(missed.at.toISOString()).toBe("2026-06-13T00:00:00.000Z"); // falls back to scheduledDate
  });
});

describe("groupTimelineByDay", () => {
  it("buckets a sorted feed into newest-first days", () => {
    const tl = buildPatientTimeline({
      calls: [
        { id: "c1", createdAt: D("2026-05-02T09:00:00Z"), outcome: "call_later" },
        { id: "c2", createdAt: D("2026-05-02T15:00:00Z"), outcome: "call_later" },
        { id: "c3", createdAt: D("2026-05-01T12:00:00Z"), outcome: "call_later" },
      ],
    });
    const days = groupTimelineByDay(tl);
    expect(days.map((d) => d.day)).toEqual(["2026-05-02", "2026-05-01"]);
    expect(days[0].events).toHaveLength(2);
    expect(days[1].events).toHaveLength(1);
  });
});

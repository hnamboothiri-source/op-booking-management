import {
  retentionScore,
  retentionCategoryFromDays,
  riskFromRetention,
  wellnessScore,
  therapyProgress,
  DEFAULT_RETENTION_THRESHOLDS,
  type RetentionThresholds,
} from "@prm/core";
import { prisma } from "../db";

// retentionCategory → PatientCategory enum (no "lost" in patient category).
function patientCategoryFor(cat: string, repeat: boolean): string {
  if (cat === "active") return repeat ? "repeat_patient" : "new_patient";
  if (cat === "at_risk") return "at_risk";
  return "dormant"; // dormant | lost
}

const MS_DAY = 86400000;
function daysSince(from: Date | null | undefined, today: Date): number {
  if (!from) return 9999; // never visited → treat as long-lapsed
  const d = new Date(new Date(from).toISOString().slice(0, 10)).getTime();
  return Math.max(0, Math.floor((today.getTime() - d) / MS_DAY));
}

/** Load admin-tunable thresholds from the `retention-rules` CustomRecord (mock-safe). */
async function loadRetentionThresholds(): Promise<RetentionThresholds> {
  try {
    const rec = await prisma.customRecord.findFirst({
      where: { moduleSlug: "retention", masterKey: "retention-rules" },
      orderBy: { createdAt: "desc" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (rec?.data ?? null) as any;
    if (d && Number(d.atRiskDays) && Number(d.dormantDays) && Number(d.lostDays)) {
      return { atRiskDays: Number(d.atRiskDays), dormantDays: Number(d.dormantDays), lostDays: Number(d.lostDays) };
    }
  } catch {
    /* mock or missing → defaults */
  }
  return DEFAULT_RETENTION_THRESHOLDS;
}

/**
 * Recompute retention for every patient (Module 12). Auth-free engine shared by
 * the UI action and the daily cron job. Computes retention + risk + Ayurveda
 * wellness scores, categorizes by admin-tunable day thresholds, and creates
 * dormant-reactivation + Panchakarma-renewal tasks.
 */
export async function runRetentionRecompute(): Promise<{
  scored: number;
  reactivationTasks: number;
  wellnessScored: number;
  renewalTasks: number;
}> {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const thresholds = await loadRetentionThresholds();
  const patients = await prisma.patient.findMany({ include: { _count: { select: { referralsGiven: true } } } });
  let reactivationTasks = 0;
  let wellnessScored = 0;
  let renewalTasks = 0;

  for (const p of patients) {
    const days = daysSince(p.lastVisitDate, today);
    const cat = retentionCategoryFromDays(days, thresholds);
    const months = Math.floor(days / 30);
    const rs = retentionScore({
      repeatVisit: p.lifetimeVisits > 1,
      followUpCompleted: false,
      referralGiven: (p._count?.referralsGiven ?? (p as { referralsGiven?: unknown[] }).referralsGiven?.length ?? 0) > 0,
      missedFollowUp: false,
      monthsSinceLastVisit: months,
      admissionRejected: false,
    });
    const risk = riskFromRetention(rs.score);

    await prisma.retentionStatus.upsert({
      where: { patientMrd: p.mrd },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { category: cat as any, riskScore: risk, lastEvaluatedAt: new Date() },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { patientMrd: p.mrd, category: cat as any, riskScore: risk },
    });
    await prisma.patientScore.create({ data: { patientMrd: p.mrd, kind: "retention", score: rs.score, factors: rs.factors } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.patient.update({ where: { mrd: p.mrd }, data: { category: patientCategoryFor(cat, p.lifetimeVisits > 1) as any } });

    // ── Ayurveda Wellness Score (adherence + therapy + follow-up compliance) ──
    const [courses, sessions, fups] = await Promise.all([
      prisma.medicationCourse.findMany({ where: { patientMrd: p.mrd }, select: { adherence: true } }).catch(() => [] as { adherence: string }[]),
      prisma.therapySession.findMany({ where: { patientMrd: p.mrd }, select: { status: true } }).catch(() => [] as { status: string }[]),
      prisma.followUp.findMany({ where: { patientMrd: p.mrd }, select: { status: true } }).catch(() => [] as { status: string }[]),
    ]);
    if (courses.length || sessions.length || fups.length) {
      const adherencePct = courses.length ? Math.round((courses.filter((c) => c.adherence === "on_track").length / courses.length) * 100) : 0;
      const completed = sessions.filter((s) => s.status === "completed").length;
      const missed = sessions.filter((s) => s.status === "missed").length;
      const therapyPct = therapyProgress(sessions.length, completed, missed).pct;
      const fDone = fups.filter((f) => f.status === "done").length;
      const fMissed = fups.filter((f) => f.status === "missed" || f.status === "overdue").length;
      const followUpCompliancePct = fDone + fMissed > 0 ? Math.round((fDone / (fDone + fMissed)) * 100) : 0;
      const ws = wellnessScore({ adherencePct, therapyPct, followUpCompliancePct });
      await prisma.patientScore.create({ data: { patientMrd: p.mrd, kind: "wellness", score: ws.score, factors: ws.factors } });
      wellnessScored++;
    }

    // ── Dormant / lost reactivation task ──
    if (cat === "dormant" || cat === "lost") {
      const existing = await prisma.task.findFirst({
        where: { patientMrd: p.mrd, type: "contact_dormant_patient", status: { in: ["open", "in_progress", "escalated"] } },
      });
      if (!existing) {
        await prisma.task.create({ data: { type: "contact_dormant_patient", subject: `Reactivate ${p.name}`, patientMrd: p.mrd, priority: "medium" } });
        reactivationTasks++;
      }
    }

    // ── Panchakarma renewal tracker (completed Panchakarma plan → renewal due) ──
    const completedPk = await prisma.therapyPlan
      .findFirst({ where: { patientMrd: p.mrd, therapyType: "panchakarma", status: "completed" } })
      .catch(() => null);
    if (completedPk) {
      const open = await prisma.task.findFirst({
        where: { patientMrd: p.mrd, type: "panchakarma_renewal", status: { in: ["open", "in_progress", "escalated"] } },
      });
      if (!open) {
        await prisma.task.create({ data: { type: "panchakarma_renewal", subject: `Panchakarma renewal due — ${p.name}`, patientMrd: p.mrd, priority: "medium" } });
        renewalTasks++;
      }
    }
  }

  return { scored: patients.length, reactivationTasks, wellnessScored, renewalTasks };
}

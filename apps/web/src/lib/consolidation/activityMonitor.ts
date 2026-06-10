/**
 * Group activity monitor — directors' view of every plan activity across the
 * whole group: approval pipeline counts per company/centre, the queue of
 * activities awaiting verification/approval, and a recent-changes feed.
 *
 * Cheap by construction: three queries (active plans, staff names, org tree),
 * then in-memory flattening of the plans' JSON `activities` arrays.
 */
import {
  activityRollup, approvalRollup,
  type ActivityLine, type ApprovalRollup, type ApprovalStatus, type ActivityStatus,
} from "@prm/core";
import { prisma } from "../db";
import { getModuleBySlug } from "../modules/registry";
import { companiesWithCentres } from "./rollup";

export interface MonitorCounts extends ApprovalRollup {
  total: number;
  planned: number;
  inProgress: number;
  done: number;
}

export interface MonitorRow {
  planId: string;
  index: number;
  moduleSlug: string;
  moduleName: string;
  scope: "group" | "company" | "centre";
  companyName: string | null;
  centreName: string | null;
  title: string;
  ownerName: string | null;
  approval: ApprovalStatus;
  status: ActivityStatus;
  enteredAt: string | null;
}

export interface MonitorChange {
  at: string;
  byName: string | null;
  action: string;
  detail: string | null;
  moduleName: string;
  planTitle: string;
  centreName: string | null;
}

export interface CompanyMonitor {
  companyId: string | null; // null = legacy group plans
  companyName: string;
  counts: MonitorCounts;
  centres: { branchId: string | null; name: string; counts: MonitorCounts }[]; // branchId null = the company's own plan
}

export interface ActivityMonitor {
  totals: MonitorCounts;
  byCompany: CompanyMonitor[];
  pendingQueue: MonitorRow[];
  recentChanges: MonitorChange[];
}

function counts(acts: ActivityLine[]): MonitorCounts {
  const a = approvalRollup(acts);
  const s = activityRollup(acts);
  return { ...a, total: s.total, planned: s.planned, inProgress: s.inProgress, done: s.done };
}

const addCounts = (a: MonitorCounts, b: MonitorCounts): MonitorCounts => ({
  entered: a.entered + b.entered, verified: a.verified + b.verified, approved: a.approved + b.approved, rejected: a.rejected + b.rejected,
  total: a.total + b.total, planned: a.planned + b.planned, inProgress: a.inProgress + b.inProgress, done: a.done + b.done,
});
const ZERO: MonitorCounts = { entered: 0, verified: 0, approved: 0, rejected: 0, total: 0, planned: 0, inProgress: 0, done: 0 };

export async function activityMonitor(limitQueue = 15, limitFeed = 20): Promise<ActivityMonitor> {
  const [plans, staff, companies] = await Promise.all([
    prisma.modulePlan.findMany({ where: { status: "active" } }),
    prisma.staffUser.findMany({}),
    companiesWithCentres(),
  ]);
  const staffName = (id: string | null | undefined) => staff.find((s) => s.id === id)?.name ?? null;
  const centreName = (id: string | null | undefined) =>
    id ? companies.flatMap((c) => c.centres).find((b) => b.id === id)?.name ?? null : null;
  const companyOf = (p: { branchId: string | null; companyId: string | null }) => {
    if (p.companyId) return companies.find((c) => c.id === p.companyId) ?? null;
    if (p.branchId) return companies.find((c) => c.centres.some((b) => b.id === p.branchId)) ?? null;
    return null;
  };

  const totalsAcc = { v: ZERO };
  const byCompany = new Map<string | null, CompanyMonitor>();
  const queue: MonitorRow[] = [];
  const changes: MonitorChange[] = [];

  for (const p of plans) {
    const acts = (p.activities as unknown as ActivityLine[] | null) ?? [];
    if (!acts.length) continue;
    const c = counts(acts);
    totalsAcc.v = addCounts(totalsAcc.v, c);

    const company = companyOf({ branchId: p.branchId ?? null, companyId: p.companyId ?? null });
    const key = company?.id ?? null;
    const cm = byCompany.get(key) ?? {
      companyId: key,
      companyName: company ? (company.shortName ?? company.name) : "Group plans",
      counts: ZERO,
      centres: [],
    };
    cm.counts = addCounts(cm.counts, c);
    const rowName = p.branchId ? centreName(p.branchId) ?? "Centre" : company ? "Company plan" : "Group plan";
    const centreRow = cm.centres.find((r) => r.branchId === (p.branchId ?? null) && r.name === rowName)
      ?? (() => { const r = { branchId: p.branchId ?? null, name: rowName, counts: ZERO }; cm.centres.push(r); return r; })();
    centreRow.counts = addCounts(centreRow.counts, c);
    byCompany.set(key, cm);

    const def = getModuleBySlug(p.moduleSlug);
    const moduleName = def?.name ?? p.moduleSlug;
    const scope: MonitorRow["scope"] = p.branchId ? "centre" : p.companyId ? "company" : "group";

    acts.forEach((a, i) => {
      const ap = a.approval?.status ?? "entered";
      if (ap === "entered" || ap === "verified") {
        queue.push({
          planId: p.id, index: i, moduleSlug: p.moduleSlug, moduleName, scope,
          companyName: company ? (company.shortName ?? company.name) : null,
          centreName: centreName(p.branchId), title: a.title,
          ownerName: staffName(a.ownerId), approval: ap, status: a.status,
          enteredAt: a.approval?.enteredAt ?? null,
        });
      }
      for (const ch of a.changeLog ?? []) {
        changes.push({
          at: ch.at, byName: staffName(ch.byId), action: ch.action, detail: ch.detail ?? null,
          moduleName, planTitle: p.title, centreName: centreName(p.branchId),
        });
      }
    });
  }

  // Oldest entered first — the longest-waiting approvals at the top.
  queue.sort((a, b) => (a.enteredAt ?? "9999").localeCompare(b.enteredAt ?? "9999"));
  changes.sort((a, b) => b.at.localeCompare(a.at));

  return {
    totals: totalsAcc.v,
    byCompany: [...byCompany.values()].sort((a, b) => a.companyName.localeCompare(b.companyName)),
    pendingQueue: queue.slice(0, limitQueue),
    recentChanges: changes.slice(0, limitFeed),
  };
}

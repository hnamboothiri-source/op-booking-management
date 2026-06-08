"use client";

import { useMemo, useState } from "react";
import { groupTimelineByDay, type TimelineEvent, type TimelineKind, type TimelineTone } from "@prm/core";

/** Marker colours per tone — light + dark, mirroring the Badge palette. */
const MARKER: Record<TimelineTone, string> = {
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
};

const KIND_LABEL: Record<TimelineKind, string> = {
  booking: "Appointments",
  consultation: "Consultations",
  call: "Calls",
  lead: "Leads",
  follow_up: "Follow-ups",
  communication: "Messages",
  admission: "Admissions",
  referral: "Referrals",
  waitlist: "Waitlist",
  document: "Documents",
};

const KIND_ORDER: TimelineKind[] = [
  "booking", "consultation", "call", "lead", "follow_up",
  "communication", "admission", "referral", "waitlist", "document",
];

/** Minimal 14px stroke icons keyed by kind. */
function KindIcon({ kind }: { kind: TimelineKind }) {
  const p = "h-3.5 w-3.5";
  const common = { className: p, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "booking":
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "consultation":
      return <svg {...common}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A3.5 3.5 0 0 0 15.5 6 3.5 3.5 0 0 0 9 8.5c0 2.3 1.5 4 3 5.5l3.5 3.5z" /></svg>;
    case "call":
      return <svg {...common}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>;
    case "lead":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11l-3-3-3 3" /></svg>;
    case "follow_up":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "communication":
      return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-4-1L3 20l1.1-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" /></svg>;
    case "admission":
      return <svg {...common}><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6M12 9v4M10 11h4" /></svg>;
    case "referral":
      return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>;
    case "waitlist":
      return <svg {...common}><path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2c0 .5.2 1 .6 1.4L12 12l4.4-4.4c.4-.4.6-.9.6-1.4V2" /></svg>;
    case "document":
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>;
  }
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });

const timeLabel = (at: Date) =>
  at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const chipBase = "rounded-full px-3 py-1 text-xs font-medium transition-colors";
const chipOn = "bg-rose-600 text-white";
const chipOff =
  "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800";

export function PatientTimeline({ events, initialKind }: { events: TimelineEvent[]; initialKind?: TimelineKind }) {
  const presentKinds = useMemo(() => {
    const have = new Set(events.map((e) => e.kind));
    return KIND_ORDER.filter((k) => have.has(k));
  }, [events]);

  const [active, setActive] = useState<Set<TimelineKind>>(() => (initialKind ? new Set([initialKind]) : new Set()));
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (active.size > 0 && !active.has(e.kind)) return false;
      if (q && !`${e.title} ${e.detail ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, active, query]);

  const days = groupTimelineByDay(filtered);

  const toggleKind = (k: TimelineKind) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const toggleDay = (day: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });

  const allCollapsed = days.length > 0 && days.every((d) => collapsed.has(d.day));
  const setAll = (collapse: boolean) => setCollapsed(collapse ? new Set(days.map((d) => d.day)) : new Set());

  if (events.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activity…"
          className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {days.length > 0 && (
          <button onClick={() => setAll(!allCollapsed)} className={`${chipBase} ${chipOff}`}>
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
        )}
      </div>

      {/* Kind filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => setActive(new Set())} className={`${chipBase} ${active.size === 0 ? chipOn : chipOff}`}>
          All ({events.length})
        </button>
        {presentKinds.map((k) => (
          <button key={k} onClick={() => toggleKind(k)} className={`${chipBase} ${active.has(k) ? chipOn : chipOff}`}>
            {KIND_LABEL[k]} ({events.filter((e) => e.kind === k).length})
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No events match your filters.</p>
      ) : (
        <div className="space-y-6">
          {days.map((d) => {
            const isCollapsed = collapsed.has(d.day);
            return (
              <div key={d.day}>
                <button
                  onClick={() => toggleDay(d.day)}
                  className="mb-3 flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <svg
                    className={`h-3 w-3 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  {dayLabel(d.day)}
                  <span className="font-normal normal-case text-slate-400 dark:text-slate-500">· {d.events.length}</span>
                </button>
                {!isCollapsed && (
                  <ol className="relative ml-3 border-l border-slate-200 dark:border-slate-700">
                    {d.events.map((e) => (
                      <li key={e.id} className="mb-4 ml-6">
                        <span
                          className={`absolute -left-[11px] flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-[var(--background)] ${MARKER[e.tone]}`}
                          aria-hidden
                        >
                          <KindIcon kind={e.kind} />
                        </span>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{e.title}</span>
                          <time className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">{timeLabel(e.at)}</time>
                        </div>
                        {e.detail && <p className="mt-0.5 break-words text-sm text-slate-500 dark:text-slate-400">{e.detail}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

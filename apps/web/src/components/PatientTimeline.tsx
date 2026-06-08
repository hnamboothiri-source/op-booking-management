"use client";

import { useMemo, useState } from "react";
import { groupTimelineByDay, type TimelineEvent, type TimelineKind, type TimelineTone } from "@prm/core";

/** Dot colour per tone — mirrors the Badge palette in ui.tsx. */
const DOT: Record<TimelineTone, string> = {
  slate: "bg-slate-400",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
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

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const timeLabel = (at: Date) =>
  at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export function PatientTimeline({ events }: { events: TimelineEvent[] }) {
  // Which kinds are actually present, in a stable display order.
  const presentKinds = useMemo(() => {
    const order: TimelineKind[] = [
      "booking", "consultation", "call", "lead", "follow_up",
      "communication", "admission", "referral", "waitlist", "document",
    ];
    const have = new Set(events.map((e) => e.kind));
    return order.filter((k) => have.has(k));
  }, [events]);

  const [active, setActive] = useState<Set<TimelineKind>>(new Set());

  const filtered = active.size === 0 ? events : events.filter((e) => active.has(e.kind));
  const days = groupTimelineByDay(filtered);

  const toggle = (k: TimelineKind) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  if (events.length === 0) {
    return <p className="text-sm text-slate-400">No activity recorded yet.</p>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setActive(new Set())}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            active.size === 0 ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          All ({events.length})
        </button>
        {presentKinds.map((k) => {
          const on = active.has(k);
          const count = events.filter((e) => e.kind === k).length;
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                on ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {KIND_LABEL[k]} ({count})
            </button>
          );
        })}
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-slate-400">No events match the selected filters.</p>
      ) : (
        <div className="space-y-8">
          {days.map((d) => (
            <div key={d.day}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(d.day)}</h3>
              <ol className="relative ml-2 border-l border-slate-200">
                {d.events.map((e) => (
                  <li key={e.id} className="mb-4 ml-4">
                    <span
                      className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT[e.tone]}`}
                      aria-hidden
                    />
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800">{e.title}</span>
                      <time className="shrink-0 text-xs tabular-nums text-slate-400">{timeLabel(e.at)}</time>
                    </div>
                    {e.detail && <p className="mt-0.5 text-sm text-slate-500">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

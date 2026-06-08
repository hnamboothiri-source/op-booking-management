"use client";

import type { DrillEntity, DrillFilters } from "@prm/core";
import { useDrill } from "./DrillProvider";

/**
 * A clickable section header that opens the drill drawer. Used on the patient
 * profile so each activity section ("Appointments", "Leads", …) can expand the
 * full, scoped list in place.
 */
export function DrillHeader({
  title,
  entity,
  filters,
}: {
  title: string;
  entity: DrillEntity;
  filters: DrillFilters;
}) {
  const { openDrill } = useDrill();
  return (
    <button
      type="button"
      onClick={() => openDrill({ entity, filters, label: title })}
      className="group mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-400"
    >
      {title}
      <span className="text-xs opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>⤢</span>
    </button>
  );
}

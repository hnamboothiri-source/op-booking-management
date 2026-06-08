"use client";

import type { DrillEntity, DrillFilters } from "@prm/core";
import { useDrill } from "./DrillProvider";

/**
 * An inline clickable value — for table cells (analytics, reports) where a tile
 * would be too heavy. Renders the value as an emerald, underline-on-hover button
 * that opens the drill drawer.
 */
export function DrillCount({
  value,
  entity,
  filters,
  label,
}: {
  value: React.ReactNode;
  entity: DrillEntity;
  filters: DrillFilters;
  label?: string;
}) {
  const { openDrill } = useDrill();
  return (
    <button
      type="button"
      onClick={() => openDrill({ entity, filters, label })}
      className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
    >
      {value}
    </button>
  );
}

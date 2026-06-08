"use client";

import type { DrillEntity, DrillFilters } from "@prm/core";
import { useDrill } from "./DrillProvider";

/**
 * An inline clickable value — for table cells (analytics, reports) where a tile
 * would be too heavy. Renders the value as a rose, underline-on-hover button
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
      className="font-medium text-rose-700 hover:underline dark:text-rose-400"
    >
      {value}
    </button>
  );
}

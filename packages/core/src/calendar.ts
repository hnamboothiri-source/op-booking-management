/**
 * Pure layout helper for the doctor calendar (Module 3). Buckets schedule
 * slots / bookings into a column × time-row grid the client renders as a CSS
 * calendar — no calendar library. Columns are the chosen grouping (doctor,
 * room, or branch); rows are distinct start times sorted chronologically.
 * Dependency-free + serializable so it's unit-tested and passed RSC→client.
 */

export type CalendarCellState = "open" | "booked" | "full" | "blocked";

export interface CalendarItem {
  id: string;
  /** Grouping key for the column (doctorId | roomId | branchId | "—"). */
  column: string;
  /** Slot/booking start, "HH:MM". */
  startTime: string;
  endTime?: string;
  state: CalendarCellState;
  /** Display label (patient name, "open", …). */
  label?: string;
  /** Optional href the client links the cell to. */
  href?: string;
}

export interface CalendarLayout {
  columns: string[];
  times: string[];
  /** grid[column][startTime] = items in that cell. */
  grid: Record<string, Record<string, CalendarItem[]>>;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Lay out items into a column×time grid. `columnOrder` (e.g. doctor ids in
 * display order) fixes column order and is filtered to columns actually used;
 * any extra columns present in the data are appended alphabetically.
 */
export function layoutCalendar(items: CalendarItem[], columnOrder?: string[]): CalendarLayout {
  const present = new Set(items.map((i) => i.column));
  const ordered = (columnOrder ?? []).filter((c) => present.has(c));
  const extras = [...present].filter((c) => !ordered.includes(c)).sort();
  const columns = [...ordered, ...extras];

  const times = [...new Set(items.map((i) => i.startTime))].sort((a, b) => toMin(a) - toMin(b));

  const grid: Record<string, Record<string, CalendarItem[]>> = {};
  for (const col of columns) grid[col] = {};
  for (const it of items) {
    (grid[it.column][it.startTime] ??= []).push(it);
  }
  return { columns, times, grid };
}

/**
 * Waitlist ordering (Module 3, business rule: FIFO within the same priority;
 * higher priority promoted sooner — e.g. a VIP bump raises priority). Pure so it
 * can be unit-tested and reused by the promotion worklist.
 */

export interface WaitlistOrderable {
  priority: number; // higher = sooner
  createdAt: Date;
}

/** Stable order: priority desc, then created-at asc (FIFO). Does not mutate input. */
export function sortWaitlist<T extends WaitlistOrderable>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/** The next entry that should be promoted, or undefined if none waiting. */
export function nextToPromote<T extends WaitlistOrderable>(entries: T[]): T | undefined {
  return sortWaitlist(entries)[0];
}

/** Money is stored in paise (1 rupee = 100 paise). Format for display in INR. */
export function formatINR(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

/** Parse a rupees input (e.g. "2500.50") into paise. Returns 0 for blanks/NaN. */
export function rupeesToPaise(input: string | number | null | undefined): number {
  if (input == null || input === "") return 0;
  const n = typeof input === "number" ? input : parseFloat(input);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

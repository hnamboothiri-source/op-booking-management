/**
 * Andromeda's signature decorative flourish: two faint peach dashed curves.
 * Render inside a `relative` container; it sits behind content (pointer-events
 * none, low opacity) and scales to fill the box.
 */
export function DottedAccent({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1401 613"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 -z-10 h-full w-full ${className}`}
    >
      <path
        d="M2 580C35.1785 462.015 166.359 247.408 425.652 332.866C749.767 439.688 890.318 302.84 946.338 181.583C1002.36 60.3256 1149.41 -52.8479 1400 35.4968"
        stroke="#FFE4D1"
        strokeWidth="4"
        strokeDasharray="10 10"
      />
      <path
        d="M1398 0.999977C1364.87 125.95 1233.88 353.224 974.955 262.722C651.302 149.594 510.953 294.52 455.013 422.935C399.073 551.35 252.231 671.203 2.00002 577.644"
        stroke="#FFE4D1"
        strokeWidth="4"
        strokeDasharray="10 10"
      />
    </svg>
  );
}

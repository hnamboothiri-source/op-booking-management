import Link from "next/link";

export function Badge({ tone = "slate", children }: { tone?: "slate" | "green" | "amber" | "red" | "blue"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    green: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({ href, children, tone = "primary" }: { href: string; children: React.ReactNode; tone?: "primary" | "ghost" }) {
  const cls =
    tone === "primary"
      ? "bg-rose-600 text-white hover:bg-rose-700"
      : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";
  return (
    <Link href={href} className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${cls}`}>
      {children}
    </Link>
  );
}

export function SubmitButton({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "danger" | "ghost" }) {
  const cls =
    tone === "danger"
      ? "border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
      : tone === "ghost"
      ? "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      : "bg-rose-600 text-white hover:bg-rose-700";
  return (
    <button type="submit" className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${cls}`}>
      {children}
    </button>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">{children}</div>;
}

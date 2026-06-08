import { PageHeader } from "@/components/ui";

/**
 * Per-responsibility "work desk" scaffold (Phase 24): a header, a Capture
 * section (the forms/quick-actions the role owns) and the role's queues below.
 * Keeps every front-line desk consistent.
 */
export function WorkDesk({
  title,
  subtitle,
  action,
  capture,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  capture?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} action={action} />
      {capture && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Capture</h2>
          {capture}
        </section>
      )}
      <section>{children}</section>
    </div>
  );
}

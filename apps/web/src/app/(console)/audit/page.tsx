import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireCan("audit", "view");
  const events = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every master & task mutation is recorded (Module 16 security)" />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No audit events yet.</td></tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-500">{e.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="px-4 py-2">{e.actor?.name ?? <span className="text-slate-400">system</span>}</td>
                <td className="px-4 py-2"><Badge tone="blue">{e.action}</Badge></td>
                <td className="px-4 py-2 text-slate-600">{e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

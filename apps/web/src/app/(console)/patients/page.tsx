import Link from "next/link";
import { requireCan } from "@/lib/session";
import { searchPatients } from "@/lib/patients/actions";
import { prisma } from "@/lib/db";
import { can } from "@prm/core";
import { PageHeader, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const CATEGORIES = ["new_patient", "repeat_patient", "high_value", "referred", "referring", "dormant", "at_risk", "vip"];

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const user = await requireCan("patients", "view");
  const { q, category } = await searchParams;
  const results = q
    ? await searchPatients(q)
    : (await prisma.patient.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: category ? { category: category as any } : {},
        orderBy: { updatedAt: "desc" },
        take: 50,
      })).map((p) => ({ mrd: p.mrd, name: p.name, phone: p.phone, place: p.place }));

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="HIS-style lookup + relationship segments (Module 4)"
        action={can(user.role, "patients", "create") ? <LinkButton href="/patients/new">+ New patient</LinkButton> : undefined}
      />
      <form className="mb-3 flex gap-2" action="/patients">
        <input name="q" defaultValue={q ?? ""} placeholder="Search MRD / name / phone…" className="w-80 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        <button type="submit" className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Search</button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/patients" className={`rounded-full px-3 py-1 ${!category && !q ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}>Recent</Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={`/patients?category=${c}`} className={`rounded-full px-3 py-1 ${category === c ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}>{c.replace(/_/g, " ")}</Link>
        ))}
      </div>

      {(
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2 font-medium">MRD</th><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Phone</th><th className="px-4 py-2 font-medium">Place</th></tr>
            </thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No matches.</td></tr>}
              {results.map((p) => (
                <tr key={p.mrd} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{p.mrd}</td>
                  <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(p.mrd)}`} className="font-medium text-rose-700 hover:underline">{p.name}</Link></td>
                  <td className="px-4 py-2 text-slate-600">{p.phone ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{p.place ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

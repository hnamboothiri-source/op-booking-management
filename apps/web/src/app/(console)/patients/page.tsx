import Link from "next/link";
import { requireCan } from "@/lib/session";
import { searchPatients } from "@/lib/patients/actions";
import { can } from "@prm/core";
import { PageHeader, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireCan("patients", "view");
  const { q } = await searchParams;
  const results = q ? await searchPatients(q) : [];

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="HIS-style lookup by MRD, name, or phone"
        action={can(user.role, "patients", "create") ? <LinkButton href="/patients/new">+ New patient</LinkButton> : undefined}
      />
      <form className="mb-4 flex gap-2" action="/patients">
        <input name="q" defaultValue={q ?? ""} placeholder="Search MRD / name / phone…" className="w-80 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        <button type="submit" className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Search</button>
      </form>

      {q && (
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
                  <td className="px-4 py-2"><Link href={`/patients/${encodeURIComponent(p.mrd)}`} className="font-medium text-emerald-700 hover:underline">{p.name}</Link></td>
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

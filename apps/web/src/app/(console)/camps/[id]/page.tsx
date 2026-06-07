import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addCampPatient } from "@/lib/outreach/actions";
import { can } from "@prm/core";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

export default async function CampDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCan("camps", "view");
  const camp = await prisma.camp.findUnique({
    where: { id },
    include: { organizer: true, campPatients: { orderBy: { createdAt: "desc" } } },
  });
  if (!camp) notFound();
  const recommended = camp.campPatients.filter((p) => p.recommendedVisit).length;

  return (
    <div>
      <PageHeader title={camp.name} subtitle={`${camp.location ?? ""}${camp.organizer ? ` · ${camp.organizer.name}` : ""}`} />
      <div className="mb-4"><Link href="/camps" className="text-sm text-slate-500 hover:underline">← Camps</Link></div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-2xl font-bold">{camp.campPatients.length}</div><div className="text-xs text-slate-500">Screened</div></Card>
        <Card><div className="text-2xl font-bold">{recommended}</div><div className="text-xs text-slate-500">Recommended visit</div></Card>
        <Card><div className="text-2xl font-bold">{camp.campPatients.length ? Math.round((recommended / camp.campPatients.length) * 100) : 0}%</div><div className="text-xs text-slate-500">Conversion</div></Card>
        <Card><div className="text-2xl font-bold">₹{(camp.revenue / 100).toLocaleString("en-IN")}</div><div className="text-xs text-slate-500">Revenue</div></Card>
      </div>

      {can(user.role, "camps", "edit") && (
        <Card>
          <h2 className="mb-3 font-semibold">Screen a patient</h2>
          <form action={addCampPatient.bind(null, id)} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">Name<input name="contactName" required className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Phone<input name="phone" className={input} /></label>
            <label className="text-xs font-medium text-slate-600">Complaint<input name="complaint" className={input} /></label>
            <label className="flex items-center gap-2 pt-5 text-xs font-medium text-slate-600"><input type="checkbox" name="recommendedVisit" className="h-4 w-4" /> Recommend hospital visit</label>
            <div className="col-span-2 sm:col-span-4"><SubmitButton>Add screening</SubmitButton></div>
          </form>
          <p className="mt-2 text-xs text-slate-400">Recommended-visit screenings with a phone number become leads automatically.</p>
        </Card>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Complaint</th><th className="px-4 py-2">Visit?</th></tr></thead>
          <tbody>
            {camp.campPatients.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No screenings yet.</td></tr>}
            {camp.campPatients.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{p.contactName}</td><td className="px-4 py-2 text-slate-600">{p.phone ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{p.complaint ?? "—"}</td>
                <td className="px-4 py-2">{p.recommendedVisit ? <Badge tone="green">recommended</Badge> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

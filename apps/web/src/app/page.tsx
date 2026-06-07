import { MODULES, PHASES, type BuildStatus } from "@/lib/blueprint";

const STATUS_STYLE: Record<BuildStatus, string> = {
  done: "bg-green-100 text-green-800",
  in_progress: "bg-amber-100 text-amber-800",
  planned: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<BuildStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  planned: "Planned",
};

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-emerald-700">Sreedhareeyam Ayurveda Hospital</p>
        <h1 className="text-3xl font-bold tracking-tight">Patient Relationship Management</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Lead → Appointment → Consultation → Referral/Test → Treatment/Admission → Follow-up →
          Retention → Referral → Lifetime relationship. Foundation phase scaffolded and running.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Roadmap</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PHASES.map((p) => (
            <div key={p.n} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-emerald-700">Phase {p.n}</div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-slate-500">{p.duration}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Modules ({MODULES.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">{m.id} · Phase {m.phase}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>
                  {STATUS_LABEL[m.status]}
                </span>
              </div>
              <h3 className="mt-1 font-semibold">{m.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{m.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        Spec: <code>docs/MODULES.md</code> · Data model: <code>packages/db/prisma/schema.prisma</code>
      </footer>
    </main>
  );
}

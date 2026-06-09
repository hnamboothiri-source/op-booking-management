"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createLead, findDuplicates, type DuplicateMatch } from "@/lib/leads/actions";
import { SubmitButton } from "@/components/ui";

type Opt = { id: string; name: string; group?: string | null };

const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const label = "text-sm font-medium text-slate-700 dark:text-slate-300";
const legend = "col-span-2 mt-2 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400";

export function LeadForm({ sources, campaigns, diseases, branches, staff, planRefs }: { sources: Opt[]; campaigns: Opt[]; diseases: Opt[]; branches: Opt[]; staff: Opt[]; planRefs: { ref: string; label: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const forceRef = useRef<HTMLInputElement>(null);
  const bypass = useRef(false);
  const [dupes, setDupes] = useState<DuplicateMatch[] | null>(null);
  const [checking, setChecking] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (bypass.current) { bypass.current = false; return; } // let the server action run
    e.preventDefault();
    const form = e.currentTarget;
    if (forceRef.current?.value !== "true") {
      setChecking(true);
      const fd = new FormData(form);
      const matches = await findDuplicates(String(fd.get("phone") ?? ""), String(fd.get("whatsapp") ?? ""), String(fd.get("email") ?? ""));
      setChecking(false);
      if (matches.length) { setDupes(matches); return; }
    }
    submitNow();
  }

  function submitNow() {
    bypass.current = true;
    formRef.current?.requestSubmit();
  }

  function continueAsNew() {
    if (forceRef.current) forceRef.current.value = "true";
    setDupes(null);
    submitNow();
  }

  return (
    <>
      {dupes && dupes.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-600/50 dark:bg-amber-950/30">
          <div className="font-semibold text-amber-800 dark:text-amber-200">Existing record{dupes.length > 1 ? "s" : ""} found</div>
          <p className="mt-0.5 text-amber-700 dark:text-amber-300/80">A patient or lead with the same phone / email already exists. Choose how to proceed.</p>
          <ul className="mt-3 divide-y divide-amber-200 rounded-md border border-amber-200 bg-white dark:divide-amber-800 dark:border-amber-800 dark:bg-slate-900">
            {dupes.map((d) => (
              <li key={`${d.type}-${d.id}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{d.type}</span>
                  <span className="ml-2 font-medium text-slate-800 dark:text-slate-100">{d.name}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">{d.sub}</span>
                </div>
                <Link href={d.href} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Open existing →</Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={continueAsNew} className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700">Continue as new lead</button>
            <button type="button" onClick={() => setDupes(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
          </div>
        </div>
      )}

      <form ref={formRef} action={createLead} onSubmit={onSubmit} className="grid max-w-2xl grid-cols-2 gap-4">
        <input ref={forceRef} type="hidden" name="force" value="false" readOnly />

        <div className={legend}>Basic information</div>
        <label className={label}>Name *<input name="contactName" required className={input} /></label>
        <label className={label}>Mobile *<input name="phone" required className={input} /></label>
        <label className={label}>WhatsApp<input name="whatsapp" className={input} /></label>
        <label className={label}>Email<input name="email" type="email" className={input} /></label>
        <label className={label}>Gender
          <select name="gender" className={input}><option value="">—</option><option value="male">male</option><option value="female">female</option><option value="other">other</option></select>
        </label>
        <label className={label}>Age<input name="age" type="number" min={0} max={120} className={input} /></label>
        <label className={label}>City<input name="city" className={input} /></label>
        <label className={label}>District<input name="district" className={input} /></label>

        <div className={legend}>Medical information</div>
        <label className={label}>Chief complaint<input name="chiefComplaint" className={input} /></label>
        <label className={label}>Disease category
          <select name="diseaseId" className={input}><option value="">—</option>{diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </label>
        <label className={label}>Previous treatment
          <select name="previousTreatment" className={input}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select>
        </label>
        <label className={label}>Existing patient
          <select name="existingPatient" className={input}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select>
        </label>

        <div className={legend}>Source &amp; assignment</div>
        <label className={label}>Source
          <select name="sourceId" className={input}><option value="">—</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.group ? `${s.group.replace(/_/g, " ")} · ` : ""}{s.name.replace(/_/g, " ")}</option>)}</select>
        </label>
        <label className={label}>Campaign
          <select name="campaignId" className={input}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className={label}>Response channel
          <select name="responseChannel" className={input}><option value="">—</option><option value="call">call</option><option value="whatsapp">whatsapp</option><option value="email">email</option><option value="walk_in">walk-in</option></select>
        </label>
        <label className={label}>Preferred branch
          <select name="branchId" className={input}><option value="">—</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </label>
        <label className={label}>Preferred doctor<input name="preferredDoctor" className={input} /></label>
        <label className={label}>Priority
          <select name="priority" defaultValue="medium" className={input}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
        </label>
        <label className={label}>Owner
          <select name="ownerId" className={input}><option value="">— me —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>

        <label className={`${label} col-span-2`}>Plan activity
          {planRefs.length === 0
            ? <span className="mt-1 block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">No approved lead-generation activity — <Link href="/modules/leads/plan" className="font-medium underline">plan &amp; approve first →</Link></span>
            : <select name="planRef" required className={input}>{planRefs.map((p) => <option key={p.ref} value={p.ref}>{p.label}</option>)}</select>}
        </label>

        <div className="col-span-2 flex items-center gap-3">
          <SubmitButton>{checking ? "Checking…" : "Create lead"}</SubmitButton>
          <Link href="/leads" className="text-sm text-slate-500 hover:underline">Cancel</Link>
        </div>
      </form>
    </>
  );
}

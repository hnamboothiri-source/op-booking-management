import Link from "next/link";
import { approvedActivities } from "@/lib/planning/gate";

/**
 * Required selector binding a create form to an APPROVED plan activity. If none
 * are approved, shows a prompt to plan first (the server action also enforces it).
 */
export async function PlanActivitySelect({ slug, typeKey }: { slug: string; typeKey: string }) {
  const opts = await approvedActivities(slug, typeKey);
  if (opts.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        No approved plan activity for this — <Link href={`/modules/${slug}/plan`} className="font-medium underline">plan &amp; get it approved first →</Link>
      </div>
    );
  }
  return (
    <label className="text-xs font-medium text-slate-600">Plan activity
      <select name="planRef" required className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
        {opts.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}
      </select>
    </label>
  );
}

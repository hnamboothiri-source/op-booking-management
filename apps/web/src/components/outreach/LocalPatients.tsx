import Link from "next/link";
import { Card, SubmitButton } from "@/components/ui";
import { inviteLocalPatients } from "@/lib/outreach/actions";
import type { OutreachEventType } from "@/lib/outreach/metrics";

export interface LocalPatient { mrd: string; name: string; phone: string | null; place: string | null }

/** Point 6c — existing patients in the camp's locality, with a one-click invite that
 * creates camp-visit follow-ups for them. */
export function LocalPatients({ eventType, id, location, patients, canEdit }: {
  eventType: OutreachEventType;
  id: string;
  location: string | null;
  patients: LocalPatient[];
  canEdit: boolean;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Local patients to invite</h2>
        {canEdit && patients.length > 0 && (
          <form action={inviteLocalPatients.bind(null, eventType, id)}>
            <SubmitButton>Invite {patients.length} for a camp visit</SubmitButton>
          </form>
        )}
      </div>
      {!location ? (
        <p className="text-sm text-slate-400">Set the camp location in the plan above to find existing patients nearby.</p>
      ) : patients.length === 0 ? (
        <p className="text-sm text-slate-400">No existing patients found in “{location}”. (Matched on patient <em>place</em>.)</p>
      ) : (
        <div className="space-y-1">
          {patients.map((p) => (
            <div key={p.mrd} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm">
              <Link href={`/patients/${encodeURIComponent(p.mrd)}`} className="font-medium text-rose-700 hover:underline">{p.name}</Link>
              <span className="text-slate-500">{p.phone ?? "—"} · {p.place}</span>
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-400">“Invite” creates a camp-visit follow-up for each, due on the camp date — see Follow-ups.</p>
        </div>
      )}
    </Card>
  );
}

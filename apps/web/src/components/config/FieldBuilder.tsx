/**
 * Add/remove rows of declarative `FieldDef`s. Used both for a module's plan
 * config (entry/report fields) and for a custom master's columns. No client
 * state — each row's remove and the add form are plain server-action forms.
 */
import type { FieldDef, FieldType } from "@/lib/masters/registry";
import { Card, SubmitButton } from "@/components/ui";

const FIELD_TYPES: FieldType[] = ["text", "number", "money", "boolean", "select", "textarea", "ref", "date"];
const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600";

export function FieldBuilder({
  title,
  hint,
  fields,
  addAction,
  removeAction,
}: {
  title: string;
  hint?: string;
  fields: FieldDef[];
  addAction: (fd: FormData) => Promise<void>;
  removeAction: (index: number) => Promise<void>;
}) {
  return (
    <Card>
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}

      <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-1.5 font-medium">Name</th>
              <th className="px-3 py-1.5 font-medium">Label</th>
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="px-3 py-1.5 font-medium">Req</th>
              <th className="px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">No fields yet.</td></tr>
            )}
            {fields.map((f, i) => (
              <tr key={f.name} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-mono text-xs">{f.name}</td>
                <td className="px-3 py-1.5">{f.label}</td>
                <td className="px-3 py-1.5">{f.type}{f.type === "select" && f.options ? ` (${f.options.length})` : ""}</td>
                <td className="px-3 py-1.5">{f.required ? "✓" : ""}</td>
                <td className="px-3 py-1.5 text-right">
                  <form action={removeAction.bind(null, i)}>
                    <SubmitButton tone="danger">Remove</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={addAction} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className={lab}>Name<input name="name" placeholder="e.g. channel" required className={input} /></label>
        <label className={lab}>Label<input name="label" placeholder="Channel" className={input} /></label>
        <label className={lab}>Type
          <select name="type" className={input} defaultValue="text">
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={`${lab} flex items-end gap-2`}>
          <input type="checkbox" name="required" className="h-4 w-4" /> Required
        </label>
        <div className="flex items-end"><SubmitButton>+ Add field</SubmitButton></div>
        <label className={`${lab} sm:col-span-5`}>Options (for <em>select</em> — one per line, <code>value=Label</code>)
          <textarea name="options" rows={2} placeholder={"call_centre=Call centre\nfront_desk=Front desk"} className={input} />
        </label>
      </form>
    </Card>
  );
}

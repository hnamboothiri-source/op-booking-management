/**
 * Renders a single declarative `FieldDef` as a form input. Extracted from
 * `MasterForm.tsx` so it can also be dropped into the plan activity entry form
 * (custom entry fields) and the module field-aware forms.
 */
import { refOptions } from "@/lib/masters/actions";
import type { FieldDef } from "@/lib/masters/registry";

const inputCls = "mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm";

export async function FieldInput({ field, row }: { field: FieldDef; row?: Record<string, unknown> | null }) {
  const value = row?.[field.name];
  const label = (
    <label className="block text-sm font-medium text-slate-700">
      {field.label}
      {field.required && <span className="text-red-500"> *</span>}
    </label>
  );

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" name={field.name} defaultChecked={value === undefined ? true : Boolean(value)} className="h-4 w-4" />
        <span className="text-sm font-medium text-slate-700">{field.label}</span>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea name={field.name} required={field.required} defaultValue={(value as string) ?? ""} rows={4} className={inputCls} />
      </div>
    );
  }

  if (field.type === "select" || field.type === "ref") {
    const options = field.type === "ref" && field.ref ? await refOptions(field.ref) : field.options ?? [];
    return (
      <div>
        {label}
        <select name={field.name} required={field.required} defaultValue={(value as string) ?? ""} className={inputCls}>
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  // text / number / money / date
  const display =
    field.type === "money" && typeof value === "number" ? (value / 100).toString()
    : field.type === "date" && value ? new Date(value as string).toISOString().slice(0, 10)
    : (value as string) ?? "";
  return (
    <div>
      {label}
      <input
        type={field.type === "money" || field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        step={field.type === "money" ? "0.01" : undefined}
        name={field.name}
        required={field.required}
        defaultValue={display}
        className={inputCls}
      />
    </div>
  );
}

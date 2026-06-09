/**
 * FormData → typed value coercion for declarative `FieldDef`s.
 *
 * Extracted from `masters/actions.ts` (a `"use server"` file, which can only
 * export async functions) so the same logic can be reused for module custom
 * masters (`lib/config/recordActions.ts`) and plan custom entry fields.
 */
import type { FieldDef } from "./registry";

/** Coerce one form field to its typed value (money → paise, dates → Date). */
export function coerce(field: FieldDef, fd: FormData): unknown {
  const raw = fd.get(field.name);
  switch (field.type) {
    case "boolean":
      return raw === "on" || raw === "true";
    case "number": {
      const s = raw?.toString().trim();
      return s ? parseInt(s, 10) : null;
    }
    case "money": {
      const s = raw?.toString().trim();
      return s ? Math.round(parseFloat(s) * 100) : null; // rupees → paise
    }
    case "date": {
      const s = raw?.toString().trim();
      return s ? new Date(s) : null;
    }
    default: {
      const s = raw?.toString().trim();
      return s ? s : null;
    }
  }
}

/** Build a `{ [fieldName]: value }` data object from a form against a field list. */
export function buildData(fields: FieldDef[], fd: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    const v = coerce(f, fd);
    // Always include booleans (unchecked = false); include others only when set.
    if (f.type === "boolean" || v !== null) data[f.name] = v;
  }
  return data;
}

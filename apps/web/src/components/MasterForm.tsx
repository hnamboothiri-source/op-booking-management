import type { MasterDef } from "@/lib/masters/registry";
import { SubmitButton } from "@/components/ui";
import { FieldInput } from "@/components/masters/FieldInput";

export default async function MasterForm({
  master,
  row,
  action,
  submitLabel,
}: {
  master: MasterDef;
  row?: Record<string, unknown> | null;
  action: (fd: FormData) => Promise<void>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      {master.fields.map((f) => <FieldInput key={f.name} field={f} row={row} />)}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setActiveBranch } from "@/lib/auth-actions";

export interface CentreGroup {
  company: string;
  centres: { id: string; name: string }[];
}

/**
 * Centre switcher for company/group-scope users: pins every dashboard, KPI and
 * drill to one centre, or back to the whole scope ("All centres"). Centre-pinned
 * roles never see this — their branch is fixed by their staff record.
 */
export function CentreSwitcher({ groups, active }: { groups: CentreGroup[]; active: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!groups.some((g) => g.centres.length)) return null;
  return (
    <select
      aria-label="Centre"
      value={active ?? ""}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("branchId", e.target.value);
        startTransition(async () => {
          await setActiveBranch(fd);
          router.refresh();
        });
      }}
      className="max-w-[180px] truncate rounded-md border border-slate-300 bg-transparent px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:max-w-[220px]"
    >
      <option value="">All centres</option>
      {groups.map((g) => (
        <optgroup key={g.company} label={g.company}>
          {g.centres.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

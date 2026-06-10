import Link from "next/link";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MODULE_DASHBOARDS, planActivityTypes } from "@/lib/modules/registry";
import {
  ROLE_GRANTS, designationTree, approverOf, directReportsOf,
  type ActivityAccess, type DesignationNode, type DesignationTreeNode, type ModuleRanks, type PageAccess,
} from "@prm/core";
import { createDesignation, updateDesignation, assignDesignation } from "@/lib/designations/actions";
import { TOOL_OPTIONS } from "@/lib/tools";
import { PageHeader, Card, Badge, SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const lab = "text-xs font-medium text-slate-600 dark:text-slate-300";
const GROUP_ORDER = ["Engagement", "Clinical", "Outreach", "Growth", "Workflow", "Admin"];
const ROLE_NAMES = Object.keys(ROLE_GRANTS);
const humanize = (s: string) => s.replace(/_/g, " ");

/** The pickable pages of a module: its workspaces + the standard subpages. */
function modulePages(slug: string): { label: string; href: string }[] {
  const def = MODULE_DASHBOARDS.find((m) => m.slug === slug);
  if (!def) return [];
  const seen = new Set<string>();
  const pages = [
    ...def.links.map((l) => ({ label: l.label, href: l.href })),
    { label: "Plan", href: `/modules/${slug}/plan` },
    { label: "Reports", href: `/modules/${slug}/reports` },
    { label: "Masters", href: `/modules/${slug}/masters` },
    { label: "Configure", href: `/modules/${slug}/configure` },
    { label: "Guide", href: `/modules/${slug}/guide` },
  ];
  return pages.filter((p) => (seen.has(p.href) ? false : (seen.add(p.href), true)));
}

function rankTone(rank: string) {
  return rank === "manager" ? "green" : rank === "supervisor" ? "blue" : "slate";
}

/** One org-chart row + its nested reports; the name opens that designation's editor. */
function TreeRow({ t, all, staff, depth }: { t: DesignationTreeNode; all: DesignationNode[]; staff: { name: string; designationId?: string | null }[]; depth: number }) {
  const holders = staff.filter((s) => s.designationId === t.node.id).map((s) => s.name);
  const approver = approverOf(all, t.node.id);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 py-1.5 text-sm first:border-t-0 dark:border-slate-700" style={{ paddingLeft: depth * 22 }}>
        {depth > 0 && <span className="text-slate-300">└</span>}
        <Link href={`/designations?d=${t.node.id}`} className="font-medium text-rose-800 hover:underline dark:text-rose-300">{t.node.name}</Link>
        <Badge tone="slate">L{t.node.level}</Badge>
        <Badge tone={rankTone(t.node.planRank)}>{t.node.planRank}</Badge>
        <span className="text-xs text-slate-400">{humanize(t.node.roleTemplate)}</span>
        {approver && <span className="text-xs text-slate-400">· authorised by {approver.name}</span>}
        <span className="text-xs text-slate-500">{holders.length ? `· ${holders.join(", ")}` : "· no staff yet"}</span>
        {directReportsOf(all, t.node.id).length > 0 && <span className="text-[11px] text-slate-400">({directReportsOf(all, t.node.id).length} reporting)</span>}
      </div>
      {t.children.map((c) => <TreeRow key={c.node.id} t={c} all={all} staff={staff} depth={depth + 1} />)}
    </>
  );
}

/** The allotment editor: identity + hierarchy fields and the three-level pick lists (modules → pages → activities). */
function DesignationFields({ d, all, companies }: {
  d: Partial<DesignationNode> | null;
  all: DesignationNode[];
  companies: { id: string; label: string }[];
}) {
  const pageAccess = (d?.pageAccess ?? {}) as PageAccess;
  const activityAccess = (d?.activityTypes ?? {}) as ActivityAccess;
  const moduleRanks = (d?.moduleRanks ?? {}) as ModuleRanks;
  const moduleSet = new Set(d?.moduleSlugs ?? []);
  // Reporting/approver options: group-level + same-company designations (not itself).
  const refOptions = all.filter((x) => x.active && x.id !== d?.id && (x.companyId === null || x.companyId === (d?.companyId ?? null)));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className={lab}>Designation name<input name="name" defaultValue={d?.name ?? ""} required className={input} /></label>
        <label className={lab}>Catalogue
          {d?.id ? (
            <>
              <input type="hidden" name="companyId" value={d.companyId ?? ""} />
              <div className={`${input} bg-slate-50 text-slate-500`}>{companies.find((c) => c.id === (d.companyId ?? ""))?.label ?? "Group level"}</div>
            </>
          ) : (
            <select name="companyId" className={input}>
              <option value="">Group level</option>
              {companies.filter((c) => c.id).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </label>
        <label className={lab}>Level (1 = top)<input name="level" type="number" min={1} defaultValue={d?.level ?? 5} className={input} /></label>
        <label className={lab}>Role template (rights base)
          <select name="roleTemplate" defaultValue={d?.roleTemplate ?? "patient_success_executive"} className={input}>
            {ROLE_NAMES.filter((r) => r !== "administrator").map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
          </select>
        </label>
        <label className={lab}>Approvals they can make
          <select name="planRank" defaultValue={d?.planRank ?? "staff"} className={input}>
            <option value="read_only">read only (view only)</option>
            <option value="staff">enter only (staff)</option>
            <option value="supervisor">verify (supervisor)</option>
            <option value="manager">approve (manager)</option>
          </select>
        </label>
        <label className={`${lab} flex items-end gap-2 pb-1.5`}><input type="checkbox" name="active" defaultChecked={d?.active !== false} className="rounded border-slate-300" /> Active</label>
        <label className={`${lab} sm:col-span-3`}>Reporting officer (designation)
          <select name="reportsToDesignationId" defaultValue={d?.reportsToDesignationId ?? ""} className={input}>
            <option value="">— none (top of catalogue) —</option>
            {refOptions.map((r) => <option key={r.id} value={r.id}>{r.name}{r.companyId === null ? " (group)" : ""}</option>)}
          </select>
        </label>
        <label className={`${lab} sm:col-span-3`}>Authorised by (approver of their actions)
          <select name="approverDesignationId" defaultValue={d?.approverDesignationId ?? ""} className={input}>
            <option value="">Same as reporting officer</option>
            {refOptions.map((r) => <option key={r.id} value={r.id}>{r.name}{r.companyId === null ? " (group)" : ""}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tools access — admin-granted; none ticked = role default. (Admin pages still require admin rights to save.)</div>
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 rounded border border-slate-100 p-2 dark:border-slate-700">
          {TOOL_OPTIONS.map((t) => (
            <label key={t.key} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name={`tool:${t.key}`} defaultChecked={(d?.tools ?? []).includes(t.key)} className="rounded border-slate-300" />
              {t.label}
            </label>
          ))}
        </div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Allot from the main lists — tick a module, then (optionally) limit it to specific pages and activity types. Nothing ticked = role default / all.</div>
        <div className="space-y-3">
          {GROUP_ORDER.filter((g) => MODULE_DASHBOARDS.some((m) => m.group === g)).map((group) => (
            <div key={group}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</div>
              <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {MODULE_DASHBOARDS.filter((m) => m.group === group).map((m) => {
                  const pages = pageAccess[m.slug] ?? [];
                  const acts = activityAccess[m.slug] ?? [];
                  const activityTypes = planActivityTypes(m.slug);
                  return (
                    <div key={m.slug} className="rounded border border-slate-100 p-2 dark:border-slate-700">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <input type="checkbox" name="modules" value={m.slug} defaultChecked={moduleSet.has(m.slug)} className="rounded border-slate-300" />
                        {m.name}
                      </label>
                      <div className="mt-1 grid grid-cols-1 gap-2 pl-5 sm:grid-cols-2">
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pages</div>
                          {modulePages(m.slug).map((p) => (
                            <label key={p.href} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <input type="checkbox" name={`page:${m.slug}:${p.href}`} defaultChecked={pages.includes(p.href)} className="rounded border-slate-300" />
                              {p.label}
                            </label>
                          ))}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Activities</div>
                          {activityTypes.length === 0 && <div className="text-[10px] text-slate-300">no typed activities</div>}
                          {activityTypes.map((t) => (
                            <label key={t.key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <input type="checkbox" name={`act:${m.slug}:${t.key}`} defaultChecked={acts.includes(t.key)} className="rounded border-slate-300" />
                              {t.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 pl-5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Approval here</span>
                        <select name={`rank:${m.slug}`} defaultValue={moduleRanks[m.slug] ?? ""} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600">
                          <option value="">designation default</option>
                          <option value="read_only">read only</option>
                          <option value="staff">enter only</option>
                          <option value="supervisor">verify</option>
                          <option value="manager">approve</option>
                        </select>
                      </div>
                      <div className="pl-5 pt-1 text-[10px] text-slate-400">none ticked = all pages / all activities</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default async function DesignationsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireCan("masters", "edit");
  const { d: selectedId } = await searchParams;
  const [designationsRaw, companies, staff] = await Promise.all([
    prisma.designation.findMany({ orderBy: { level: "asc" } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffUser.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const all = designationsRaw as unknown as DesignationNode[];
  const catalogues: { id: string; label: string }[] = [
    { id: "", label: "Group level" },
    ...companies.map((c) => ({ id: c.id, label: (c.shortName ?? c.name) as string })),
  ];
  const assignable = staff.filter((s) => s.role !== "administrator");
  const selected = selectedId && selectedId !== "new" ? all.find((x) => x.id === selectedId) ?? null : null;
  const creating = selectedId === "new";

  return (
    <div>
      <PageHeader title="Designations & hierarchy" subtitle="Pick a designation, then allot its pages, modules & activities from the main lists — sessions follow the designation" />
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link href="/module-access" className="text-rose-700 hover:underline dark:text-rose-300">← Module access by role</Link>
        <Link href="/module-access/branches" className="text-rose-700 hover:underline dark:text-rose-300">Module allotment by centre →</Link>
        <Link href="/masters/branches/new" className="text-rose-700 hover:underline dark:text-rose-300">＋ New centre</Link>
        <Link href="/masters/departments/new" className="text-rose-700 hover:underline dark:text-rose-300">＋ New department</Link>
      </div>

      {/* Org chart — click a designation to open its allotment editor */}
      <Card>
        <h2 className="mb-2 font-semibold">Organisation chart <span className="ml-2 text-xs font-normal text-slate-400">click a designation to edit it</span></h2>
        {designationTree(all).map((t) => <TreeRow key={t.node.id} t={t} all={all} staff={staff} depth={0} />)}
        {all.length === 0 && <p className="text-sm text-slate-400">No designations yet — create the first one below.</p>}
      </Card>

      {/* Picker bar */}
      <div className="mt-6 flex flex-wrap items-end gap-2">
        <form method="GET" action="/designations" className="flex items-end gap-2">
          <label className={lab}>Designation
            <select name="d" defaultValue={selected?.id ?? ""} className={`${input} w-72`}>
              <option value="">— pick a designation to allot —</option>
              {catalogues.map((cat) => {
                const rows = all.filter((x) => (x.companyId ?? "") === cat.id);
                if (!rows.length) return null;
                return (
                  <optgroup key={cat.id || "group"} label={cat.label}>
                    {rows.map((x) => <option key={x.id} value={x.id}>{x.name}{x.active ? "" : " (inactive)"}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Open</button>
        </form>
        <Link href="/designations?d=new" className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:text-rose-300">+ New designation</Link>
      </div>

      {/* Single editor for the picked designation (or the create form) */}
      <div className="mt-4">
        {creating ? (
          <Card accent>
            <h2 className="mb-3 font-semibold">New designation</h2>
            <form action={createDesignation}>
              <DesignationFields d={null} all={all} companies={catalogues} />
              <div className="mt-3"><SubmitButton>Create designation</SubmitButton></div>
            </form>
          </Card>
        ) : selected ? (
          <Card accent>
            <form action={updateDesignation}>
              <input type="hidden" name="id" value={selected.id} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selected.name}</span>
                  <Badge tone="slate">{catalogues.find((c) => c.id === (selected.companyId ?? ""))?.label ?? "Group level"}</Badge>
                  <Badge tone={rankTone(selected.planRank)}>{selected.planRank}</Badge>
                  {!selected.active && <Badge tone="red">inactive</Badge>}
                </div>
                <SubmitButton>Save allotment</SubmitButton>
              </div>
              <DesignationFields d={selected} all={all} companies={catalogues} />
            </form>
          </Card>
        ) : (
          <Card><p className="text-sm text-slate-400">Pick a designation above (or click one in the organisation chart) to open its allotment editor, or create a new one.</p></Card>
        )}
      </div>

      {/* Staff assignment */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Assign staff to designations</h2>
        <Card>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400"><tr><th className="py-1">Staff</th><th className="py-1">Stored role</th><th className="py-1">Company</th><th className="py-1">Designation</th><th /></tr></thead>
            <tbody>
              {assignable.map((s) => {
                const options = all.filter((x) => x.active && (x.companyId === null || !s.companyId || x.companyId === s.companyId));
                return (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-1.5">{s.name}<span className="ml-2 text-xs text-slate-400">{s.email}</span></td>
                    <td className="py-1.5 text-slate-500">{humanize(String(s.role))}</td>
                    <td className="py-1.5 text-slate-500">{companies.find((c) => c.id === s.companyId)?.code ?? "—"}</td>
                    <td className="py-1.5" colSpan={2}>
                      <form action={assignDesignation} className="flex items-center gap-2">
                        <input type="hidden" name="staffId" value={s.id} />
                        <select name="designationId" defaultValue={(s as { designationId?: string | null }).designationId ?? ""} className="w-64 rounded-md border border-slate-300 px-2 py-1 text-sm">
                          <option value="">— none (use stored role) —</option>
                          {options.map((x) => <option key={x.id} value={x.id}>{x.name}{x.companyId === null ? " (group)" : ""}</option>)}
                        </select>
                        <SubmitButton>Save</SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-400">A staff member's session takes its rights, approval powers and authorizer from the designation. Administrators stay unrestricted.</p>
        </Card>
      </section>
    </div>
  );
}

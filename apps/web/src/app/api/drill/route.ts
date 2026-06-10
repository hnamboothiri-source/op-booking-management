import { NextRequest, NextResponse } from "next/server";
import { can, pickAllowedFilters, type DrillEntity, type DrillFilters, type DrillResult } from "@prm/core";
import { getCurrentUser } from "@/lib/session";
import { userScopeWhere } from "@/lib/scope";
import { DRILL, drillListHref } from "@/lib/drill/registry";

/**
 * Drill-down preview. GET /api/drill?e=<entity>&f=<json>&take=15.
 * Returns the first rows behind a figure plus the total and the filtered
 * list-page URL. Auth mirrors the CSV export route; the entity's RBAC resource
 * is re-checked here and branch scoping is applied server-side — the client is
 * never trusted. Filter keys are restricted to the entity's allow-list.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const entity = req.nextUrl.searchParams.get("e") as DrillEntity | null;
  const def = entity ? DRILL[entity] : undefined;
  if (!entity || !def) return NextResponse.json({ error: "unknown entity" }, { status: 400 });

  if (!can(user.role, def.resource, "view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let raw: DrillFilters = {};
  try {
    const f = req.nextUrl.searchParams.get("f");
    if (f) raw = JSON.parse(f) as DrillFilters;
  } catch {
    return NextResponse.json({ error: "bad filters" }, { status: 400 });
  }
  const filters = pickAllowedFilters(raw, def.filters);

  const takeParam = Number(req.nextUrl.searchParams.get("take"));
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 50) : 15;

  const where = { ...def.buildWhere(filters), ...(def.branchScoped ? await userScopeWhere(user) : {}) };
  const { rows, total } = await def.preview(where, take);

  const result: DrillResult = { title: def.label(filters), total, listHref: drillListHref(entity, filters), rows };
  return NextResponse.json(result);
}

/**
 * Central-masters overlay (Phase 2 of the group portal plan).
 *
 * Hydrates the mock store's MASTER data (companies, branches, departments,
 * doctors, staff) from the group's central Supabase `core` schema, so every
 * dropdown/scope/login shows real org data while transactions stay mock.
 *
 * Rules:
 * - Merge IN PLACE (field-assign / push only). Fixture rows are referenced by
 *   object identity from transaction fixtures — never reassign or splice the
 *   master arrays.
 * - Any failure (env unset, offline, bad credentials) resolves silently: the
 *   bundled fixtures are always the fallback.
 * - Synced rows carry `coreId` — the future migration handle (Phase 4).
 *
 * Enable with env: CORE_SYNC=1, CORE_SUPABASE_URL, CORE_SUPABASE_ANON_KEY,
 * CORE_SYNC_EMAIL, CORE_SYNC_PASSWORD (a central staff account).
 */
import { store } from "./mock/dataset";

type Row = Record<string, any>;

const TTL_MS = 5 * 60 * 1000;

const ROLE_NAMES = new Set([
  "administrator", "management", "call_center_executive", "call_center_manager",
  "front_office", "doctor", "optometry_staff", "lab_staff", "pharmacy_staff",
  "admission_counsellor", "patient_success_executive", "marketing_team",
  "branch_manager", "company_manager", "camp_coordinator",
  "mobile_clinic_coordinator", "module_manager",
]);

type SyncState = {
  promise: Promise<void> | null;
  fetchedAt: number;
  token: string | null;
  tokenExpiresAt: number;
};

function state(): SyncState {
  const g = globalThis as any;
  return (g.__PRM_CORE_SYNC__ ??= { promise: null, fetchedAt: 0, token: null, tokenExpiresAt: 0 });
}

function env() {
  const url = process.env.CORE_SUPABASE_URL;
  const key = process.env.CORE_SUPABASE_ANON_KEY;
  const email = process.env.CORE_SYNC_EMAIL;
  const password = process.env.CORE_SYNC_PASSWORD;
  if (!process.env.CORE_SYNC || !url || !key || !email || !password) return null;
  return { url, key, email, password };
}

async function getToken(cfg: NonNullable<ReturnType<typeof env>>): Promise<string | null> {
  const s = state();
  if (s.token && Date.now() < s.tokenExpiresAt - 60_000) return s.token;
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  s.token = json.access_token;
  s.tokenExpiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  return s.token;
}

async function coreGet(cfg: NonNullable<ReturnType<typeof env>>, token: string, table: string, select = "*"): Promise<Row[] | null> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${token}`,
      "Accept-Profile": "core",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Row[];
}

const norm = (s: string) =>
  s.toLowerCase().replace(/\bdr\.?\s*/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

const shortId = (uuid: string) => uuid.replace(/-/g, "").slice(0, 10);

function mergeMasters(data: {
  companies: Row[];
  branches: Row[];
  departments: Row[];
  doctors: Row[];
  staff: Row[];
  roles: Row[];
}) {
  const companies: Row[] = (store.company ??= []);
  const branches: Row[] = (store.branch ??= []);
  const departments: Row[] = (store.department ??= []);
  const doctors: Row[] = (store.doctor ??= []);
  const staffUsers: Row[] = (store.staffUser ??= []);

  // --- Companies: SAEH → co-saeh, SAEC → co-saec; others appended.
  const companyLocalId = new Map<string, string>(); // coreId → local id
  for (const c of data.companies) {
    const local =
      c.code === "SAEH" ? companies.find((x) => x.id === "co-saeh")
      : c.code === "SAEC" ? companies.find((x) => x.id === "co-saec")
      : companies.find((x) => x.coreId === c.id || x.code === c.code);
    if (local) {
      local.name = c.name;
      if (c.short_name) local.shortName = c.short_name;
      local.active = c.is_active;
      local.coreId = c.id;
      companyLocalId.set(c.id, local.id);
    } else {
      const id = `co-core-${shortId(c.id)}`;
      companies.push({ id, name: c.name, shortName: c.short_name ?? c.name, code: c.code, active: c.is_active, coreId: c.id });
      companyLocalId.set(c.id, id);
    }
  }

  // --- Branches: seeded core UUIDs alias onto the two main fixture branches;
  // factory branches skipped (not patient-facing); the rest merge by name.
  const BRANCH_ALIAS: Record<string, string> = {
    "b0000000-0000-4000-8000-000000000001": "br-main",
    "b0000000-0000-4000-8000-000000000002": "br-koc",
  };
  const branchLocalId = new Map<string, string>();
  for (const b of data.branches) {
    if (b.type === "factory") continue;
    const local =
      branches.find((x) => x.id === BRANCH_ALIAS[b.id]) ??
      branches.find((x) => x.coreId === b.id) ??
      branches.find((x) => x.name.toLowerCase() === String(b.name).toLowerCase());
    if (local) {
      local.name = b.name;
      if (b.district) local.location = b.district;
      local.active = b.is_active;
      local.coreId = b.id;
      branchLocalId.set(b.id, local.id);
    } else {
      const id = `br-core-${shortId(b.id)}`;
      branches.push({
        id, name: b.name, code: b.code, location: b.district ?? b.state ?? "",
        companyId: companyLocalId.get(b.company_id) ?? null,
        type: b.type === "op_centre" ? "op_centre" : "hospital",
        enabledModules: [], active: b.is_active, coreId: b.id,
      });
      branchLocalId.set(b.id, id);
    }
  }

  // --- Departments: merge by name.
  for (const d of data.departments) {
    const local = departments.find(
      (x) => x.coreId === d.id || x.name.toLowerCase() === String(d.name).toLowerCase()
    );
    if (local) {
      local.active = d.is_active;
      local.coreId = d.id;
    } else {
      departments.push({ id: `dep-core-${shortId(d.id)}`, name: d.name, active: d.is_active, coreId: d.id });
    }
  }

  // --- Doctors: merge by normalized name; unmatched get safe mock defaults.
  for (const d of data.doctors) {
    const n = norm(String(d.name));
    const local = doctors.find((x) => x.coreId === d.id || norm(String(x.name)) === n);
    if (local) {
      if (d.designation) local.designation = d.designation;
      local.active = d.is_active;
      local.coreId = d.id;
    } else {
      doctors.push({
        id: `doc-core-${shortId(d.id)}`, name: d.name, role: "consultant",
        designation: d.designation ?? d.specialty ?? null, opDoctor: true, dailyTarget: 4,
        newTargetPct: 65, followupTargetPct: 35, registrationNo: null,
        active: d.is_active, coreId: d.id,
      });
    }
  }

  // --- Staff: merge by email; role from core grants → designation keywords.
  const prmRole = new Map<string, string>();
  const portalAdmins = new Set<string>();
  for (const r of data.roles) {
    if (r.module === "prm" && ROLE_NAMES.has(r.role)) prmRole.set(r.staff_id, r.role);
    if (r.module === "portal" && (r.role === "admin" || r.role === "super_admin")) portalAdmins.add(r.staff_id);
  }
  const roleFor = (s: Row): string => {
    if (prmRole.has(s.id)) return prmRole.get(s.id)!;
    if (portalAdmins.has(s.id)) return "administrator";
    const des = String(s.designation ?? "").toLowerCase();
    if (/doctor|physician|medical officer/.test(des)) return "doctor";
    if (/director|management|ceo/.test(des)) return "management";
    if (/manager/.test(des)) return "branch_manager";
    return "front_office";
  };
  const rankFor = (role: string) =>
    ["management", "company_manager", "administrator", "module_manager"].includes(role) ? "manager"
    : ["branch_manager", "call_center_manager"].includes(role) ? "supervisor" : "staff";

  for (const s of data.staff) {
    if (!s.email) continue;
    const local = staffUsers.find(
      (x) => x.coreId === s.id || (x.email && x.email.toLowerCase() === String(s.email).toLowerCase())
    );
    if (local) {
      local.name = s.full_name;
      local.active = s.is_active;
      local.coreId = s.id;
    } else {
      const role = roleFor(s);
      staffUsers.push({
        id: `stf-core-${shortId(s.id)}`, name: s.full_name, email: s.email, role,
        branchId: s.all_branches ? null : branchLocalId.get(s.primary_branch_id) ?? "br-main",
        companyId: companyLocalId.get(s.company_id) ?? "co-saeh",
        active: s.is_active, managedModules: [], planRank: rankFor(role), coreId: s.id,
      });
    }
  }
}

// Returns true on a successful merge so failures are NOT cached for the TTL —
// the first dev-server request often blocks the event loop long enough (page
// compile) to spuriously time out the connect; the next request must retry.
async function doSync(): Promise<boolean> {
  const cfg = env();
  if (!cfg) {
    console.warn("[core-sync] disabled: env vars missing");
    return true; // permanent condition — no point retrying
  }
  try {
    const token = await getToken(cfg);
    if (!token) {
      console.warn("[core-sync] auth failed");
      return false;
    }
    // Sequential on purpose: parallel fetches to one origin hit spurious
    // connect timeouts under the Next dev server's patched fetch.
    const companies = await coreGet(cfg, token, "companies");
    const branches = await coreGet(cfg, token, "branches");
    const departments = await coreGet(cfg, token, "departments");
    const doctors = await coreGet(cfg, token, "doctors");
    const staff = await coreGet(cfg, token, "staff");
    const roles = await coreGet(cfg, token, "staff_module_roles", "staff_id,module,role");
    if (!companies || !branches || !departments || !staff) {
      console.warn("[core-sync] fetch failed", {
        companies: !!companies, branches: !!branches, departments: !!departments, staff: !!staff,
      });
      return false;
    }
    mergeMasters({
      companies, branches, departments,
      doctors: doctors ?? [], staff, roles: roles ?? [],
    });
    console.log(`[core-sync] merged ${companies.length} companies, ${branches.length} branches, ${staff.length} staff`);
    return true;
  } catch (err) {
    console.warn("[core-sync] falling back to fixtures:", err);
    return false;
  }
}

/** Await before reading masters. Resolved no-op within the 5-minute TTL. */
export function ensureCoreSync(): Promise<void> {
  const s = state();
  if (!env()) return Promise.resolve();
  if (s.promise && Date.now() - s.fetchedAt < TTL_MS) return s.promise;
  s.fetchedAt = Date.now();
  s.promise = doSync().then((ok) => {
    if (!ok) s.fetchedAt = 0; // failed sync → retry on the next request
  });
  return s.promise;
}

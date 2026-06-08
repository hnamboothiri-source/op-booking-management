"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { DrillEntity, DrillFilters, DrillResult } from "@prm/core";
import { Badge } from "@/components/ui";

interface DrillRequest {
  entity: DrillEntity;
  filters: DrillFilters;
  label?: string;
}

interface DrillContextValue {
  openDrill: (req: DrillRequest) => void;
}

const DrillContext = createContext<DrillContextValue | null>(null);

export function useDrill(): DrillContextValue {
  const ctx = useContext(DrillContext);
  if (!ctx) throw new Error("useDrill must be used within <DrillProvider>");
  return ctx;
}

export function DrillProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [fallbackTitle, setFallbackTitle] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const openDrill = useCallback((req: DrillRequest) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);
    setFallbackTitle(req.label ?? "");

    const params = new URLSearchParams({ e: req.entity, f: JSON.stringify(req.filters), take: "15" });
    fetch(`/api/drill?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "You don't have access to this data." : `Request failed (${r.status})`);
        return (await r.json()) as DrillResult;
      })
      .then((data) => setResult(data))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const title = result?.title ?? fallbackTitle ?? "Details";

  return (
    <DrillContext.Provider value={{ openDrill }}>
      {children}

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={close} aria-hidden />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                {result && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {result.total} {result.total === 1 ? "record" : "records"}
                    {result.total > result.rows.length ? ` · showing first ${result.rows.length}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loading && <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading…</p>}
              {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
              {result && !loading && result.rows.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No matching records.</p>
              )}
              {result && !loading && result.rows.length > 0 && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.rows.map((row, i) => {
                    const inner = (
                      <div className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{row.title}</div>
                          {row.subtitle && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{row.subtitle}</div>}
                        </div>
                        {row.badge && <Badge tone={row.badgeTone ?? "slate"}>{row.badge}</Badge>}
                      </div>
                    );
                    return row.href ? (
                      <li key={i}>
                        <Link href={row.href} onClick={close} className="block rounded px-1 hover:bg-slate-50 dark:hover:bg-slate-800">{inner}</Link>
                      </li>
                    ) : (
                      <li key={i} className="px-1">{inner}</li>
                    );
                  })}
                </ul>
              )}
            </div>

            {result && !loading && (
              <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
                <Link
                  href={result.listHref}
                  onClick={close}
                  className="inline-flex items-center gap-1 text-sm font-medium text-rose-700 hover:underline dark:text-rose-400"
                >
                  View full list →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </DrillContext.Provider>
  );
}

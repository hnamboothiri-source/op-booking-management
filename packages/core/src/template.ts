/**
 * Message-template rendering (Module 11). Replaces `{{key}}` placeholders with
 * values; unknown/empty keys collapse to an empty string. Pure + tested so the
 * composer (client) and the send action (server) resolve identically.
 */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

/** Placeholder keys referenced in a template body (deduped, in order). */
export function templatePlaceholders(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) seen.add(m[1]);
  return [...seen];
}

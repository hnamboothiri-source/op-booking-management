"use client";

import { useMemo, useState } from "react";
import { templatePlaceholders } from "@prm/core";
import { sendOne } from "@/lib/communication/actions";
import { SubmitButton } from "@/components/ui";

interface TemplateOpt {
  id: string;
  name: string;
  channel: string;
  body: string;
}

const input = "mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";
const CHANNELS = ["whatsapp", "sms", "email"];

/**
 * Template-driven composer (Module 11): picking a template auto-fills the
 * editable body and switches the channel; `{{name}}`, `{{first_name}}`,
 * `{{place}}`, `{{phone}}` resolve per patient on send.
 */
export default function MessageComposer({ templates }: { templates: TemplateOpt[] }) {
  const [channel, setChannel] = useState("whatsapp");
  const [templateId, setTemplateId] = useState("");
  const [body, setBody] = useState("");

  const placeholders = useMemo(() => templatePlaceholders(body), [body]);

  function onPickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setBody(t.body);
      if (CHANNELS.includes(t.channel)) setChannel(t.channel);
    }
  }

  return (
    <form action={sendOne} className="space-y-3">
      <input name="patientMrd" placeholder="Patient MRD" className={input} />
      <div className="grid grid-cols-2 gap-2">
        <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={input}>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="templateId" value={templateId} onChange={(e) => onPickTemplate(e.target.value)} className={input}>
          <option value="">— template —</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Message body (pick a template or type your own)" className={input} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Placeholders: <code>{"{{name}}"}</code> <code>{"{{first_name}}"}</code> <code>{"{{place}}"}</code>
          {placeholders.length > 0 && <> · in use: {placeholders.map((p) => `{{${p}}}`).join(" ")}</>}
        </span>
        <SubmitButton>Send</SubmitButton>
      </div>
    </form>
  );
}

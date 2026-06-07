/**
 * Outbound channel adapters (master doc §9, Module 11).
 * Phase 0 ships a console/no-op driver so the rest of the system can be built
 * and tested without live credentials. Real drivers (WhatsApp Business API,
 * SMS gateway, email) are swapped in during Phase 3.
 */

export type Channel = "whatsapp" | "sms" | "email" | "app_notification";

export interface OutboundMessage {
  channel: Channel;
  to: string;
  template: string;
  body?: string;
  language?: string;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  status: "queued" | "sent" | "failed";
  error?: string;
}

export interface MessageDriver {
  readonly name: string;
  send(msg: OutboundMessage): Promise<SendResult>;
}

/** No-op driver for local dev / tests — logs and reports success. */
export const consoleDriver: MessageDriver = {
  name: "console",
  async send(msg) {
    // eslint-disable-next-line no-console
    console.log(`[${msg.channel}] -> ${msg.to} (${msg.template})`, msg.body ?? "");
    return { ok: true, status: "queued", providerId: `console-${Date.now()}` };
  },
};

let activeDriver: MessageDriver = consoleDriver;

export function setDriver(driver: MessageDriver) {
  activeDriver = driver;
}

export function sendMessage(msg: OutboundMessage): Promise<SendResult> {
  return activeDriver.send(msg);
}

// --- Inbound lead webhooks (website form, Meta/Google lead ads) ---

export interface InboundLead {
  contactName: string;
  phone: string;
  email?: string;
  source: "website" | "facebook" | "google";
  campaignRef?: string;
  disease?: string;
}

/** Normalise a provider payload into our InboundLead shape. Real parsers added in Phase 3. */
export function normaliseInboundLead(
  source: InboundLead["source"],
  payload: Record<string, unknown>,
): InboundLead {
  return {
    source,
    contactName: String(payload.name ?? payload.full_name ?? "Unknown"),
    phone: String(payload.phone ?? payload.phone_number ?? ""),
    email: payload.email ? String(payload.email) : undefined,
    campaignRef: payload.campaign_id ? String(payload.campaign_id) : undefined,
    disease: payload.disease ? String(payload.disease) : undefined,
  };
}

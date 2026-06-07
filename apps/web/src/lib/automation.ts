/**
 * App-level automation runner. Consults the declarative rules in @prm/core
 * (master doc §10) and executes their actions against the DB / messaging
 * drivers. Called from server actions after domain events.
 */
import { rulesFor, type DomainEvent } from "@prm/core";
import { sendMessage } from "@prm/integrations";
import { prisma } from "./db";

export interface AutomationContext {
  actorId?: string | null;
  patientMrd?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  campaignId?: string | null;
  to?: string | null; // phone / email for messaging
}

function subjectFor(taskType: string, event: DomainEvent): string {
  const label = taskType.replace(/_/g, " ");
  return `${label} (auto: ${event.replace(/_/g, " ")})`;
}

/** Execute every rule registered for `event`. Best-effort; never throws to caller. */
export async function runAutomation(event: DomainEvent, ctx: AutomationContext): Promise<string[]> {
  const fired: string[] = [];
  try {
    for (const rule of rulesFor(event)) {
      for (const action of rule.actions) {
        switch (action.kind) {
          case "create_task":
            await prisma.task.create({
              data: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: action.taskType as any,
                subject: subjectFor(action.taskType, event),
                patientMrd: ctx.patientMrd ?? null,
                leadId: ctx.leadId ?? null,
                priority: "high",
              },
            });
            fired.push(`task:${action.taskType}`);
            break;

          case "send_message":
            if (ctx.to) {
              const res = await sendMessage({ channel: action.channel, to: ctx.to, template: action.template });
              await prisma.communicationLog.create({
                data: {
                  patientMrd: ctx.patientMrd ?? null,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  channel: action.channel as any,
                  toAddress: ctx.to,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  status: res.status as any,
                  sentAt: new Date(),
                  campaignId: ctx.campaignId ?? null,
                },
              });
              fired.push(`message:${action.channel}:${action.template}`);
            }
            break;

          case "escalate_to_manager":
          case "alert_user":
            await prisma.task.create({
              data: {
                type: "call_back_patient",
                subject: `[${action.kind.replace(/_/g, " ")}] ${event.replace(/_/g, " ")}`,
                leadId: ctx.leadId ?? null,
                patientMrd: ctx.patientMrd ?? null,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status: (action.kind === "escalate_to_manager" ? "escalated" : "open") as any,
                priority: "urgent",
              },
            });
            fired.push(action.kind);
            break;

          // attach_campaign_source / link_revenue_to_campaign are handled inline
          // by the calling action (they need the freshly-created row).
          default:
            break;
        }
      }
    }
  } catch (err) {
    console.error("[automation] failed for", event, err);
  }
  return fired;
}

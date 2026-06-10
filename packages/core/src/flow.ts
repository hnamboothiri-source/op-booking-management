/**
 * Operator flow phases (Module flow map). A module's Start→Result journey can be
 * grouped into three phases — Planning → Implementation → Result — so operators
 * see "plan first, then execute, then measure". Pure + framework-free; the web
 * layer renders the grouping and computes plan readiness.
 */
import type { Tone } from "./engagement";

export const FLOW_PHASES = ["planning", "implementation", "result"] as const;
export type FlowPhase = (typeof FLOW_PHASES)[number];

export const FLOW_PHASE_LABELS: Record<FlowPhase, string> = {
  planning: "Planning",
  implementation: "Implementation",
  result: "Result",
};

export const FLOW_PHASE_TONE: Record<FlowPhase, Tone> = {
  planning: "blue",
  implementation: "amber",
  result: "green",
};

/** Ordering index for a phase (planning=0 … result=2); non-phases sort last. */
export function flowPhaseOrder(phase?: FlowPhase | null): number {
  const i = phase ? FLOW_PHASES.indexOf(phase) : -1;
  return i === -1 ? FLOW_PHASES.length : i;
}

/**
 * Whether an implementation step is blocked because the module requires an
 * approved plan and none exists. Planning & result steps are never blocked —
 * the whole point is that you CAN plan before a plan is approved.
 */
export function flowPhaseBlocked(phase: FlowPhase | undefined, planRequired: boolean, planReady: boolean): boolean {
  return phase === "implementation" && planRequired && !planReady;
}

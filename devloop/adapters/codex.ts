import { preToolDecision, type HookPayload } from "./hook-payload.js";

/** Codex's process-hook dialect mapped onto the shared policy core. */
export function evaluateCodexPreTool(payload: HookPayload): Record<string, unknown> {
  return preToolDecision(payload, "codex");
}

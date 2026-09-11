import { evaluate } from "./engine.js";
import { PolicyContext } from "./context.js";
import { decisionMessage, type Decision } from "./domain.js";
import { projectTool, type HarnessToolInput } from "./project.js";
import { RULES } from "../rules/index.js";
import { recordDeniedDecision } from "../friction.js";

/** One harness-neutral entrypoint for every pre-tool adapter. */
export function evaluateTool(input: HarnessToolInput): Decision {
  const change = projectTool(input);
  const identity = {
    harness: input.harness,
    sessionId: typeof input.toolInput.session_id === "string" ? input.toolInput.session_id : "",
  } as const;
  const context = new PolicyContext(input.cwd, identity);
  const result = evaluate(change, context, RULES);
  if (result.action === "deny" && context.gitRoot) {
    recordDeniedDecision(context.gitRoot, result, {
      tool: input.toolName,
      cwd: input.cwd,
      sessionId: identity.sessionId,
    });
  }
  return result;
}

export function deniedReason(input: HarnessToolInput): string | undefined {
  const result = evaluateTool(input);
  return result.action === "deny" ? decisionMessage(result) : undefined;
}

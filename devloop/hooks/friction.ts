import { appendLedger } from "../domain/context/store.js";
import type { Decision } from "./core/domain.js";

export function recordDeniedDecision(root: string, decision: Decision, input: { readonly tool: string; readonly cwd: string; readonly branch?: string; readonly sessionId?: string }): void {
  appendLedger(root, "friction", {
    kind: "friction",
    ts: Date.now() / 1_000,
    source: "guard",
    tool: input.tool,
    branch: input.branch ?? null,
    session_id: input.sessionId ?? "",
    cwd: input.cwd,
    findings: decision.findings.filter((finding) => finding.severity === "deny").map((finding) => ({
      rule: finding.rule, locator: finding.locator ?? "",
    })),
  });
}

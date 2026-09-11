import { appendLedger } from "../domain/context/store.js";
export function recordDeniedDecision(root, decision, input) {
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
//# sourceMappingURL=friction.js.map
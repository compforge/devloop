import { deniedReason } from "../hooks/core/policy.js";
export function preToolDecision(payload, configured) {
    const harness = configured ?? "claude";
    const rawInput = payload.tool_input;
    const toolInput = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput)
        ? { ...rawInput }
        : { input: String(rawInput ?? "") };
    if (typeof payload.session_id === "string")
        toolInput.session_id = payload.session_id;
    const reason = deniedReason({
        harness,
        toolName: typeof payload.tool_name === "string" ? payload.tool_name : "",
        toolInput,
        cwd: typeof payload.cwd === "string" ? payload.cwd : process.cwd(),
    });
    if (!reason)
        return {};
    return {
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: reason,
        },
        systemMessage: reason,
    };
}
//# sourceMappingURL=hook-payload.js.map
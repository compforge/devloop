#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { afterCompact, afterCwdChanged, afterFileChanged, afterTool, endSession, sessionStartOutput, userPromptOutput } from "../adapters/process-hooks.js";
import { harnessFromPayload, preToolDecision } from "../adapters/hook-payload.js";
function readPayload() {
    try {
        const parsed = JSON.parse(readFileSync(0, "utf8") || "{}");
        return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
function run(payload, harness) {
    const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
    if (event === "PreToolUse")
        return preToolDecision(payload, harness);
    if (event === "SessionStart")
        return sessionStartOutput(payload, harness);
    if (event === "UserPromptSubmit")
        return userPromptOutput(payload);
    if (event === "PostCompact")
        afterCompact(payload);
    else if (event === "PostToolUse")
        afterTool(payload, harness);
    else if (event === "CwdChanged")
        afterCwdChanged(payload);
    else if (event === "FileChanged")
        afterFileChanged(payload);
    else if (event === "SessionEnd")
        endSession(payload, harness);
    return {};
}
try {
    const payload = readPayload();
    const configured = process.env.DEVLOOP_HARNESS;
    const harness = harnessFromPayload(payload, configured === "claude" || configured === "codex" ? configured : undefined);
    process.stdout.write(JSON.stringify(run(payload, harness)));
}
catch {
    // Process hooks are policy adapters: runtime defects must fail open.
    process.stdout.write("{}");
}
//# sourceMappingURL=runtime.js.map
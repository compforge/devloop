#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { afterCompact, afterCwdChanged, afterFileChanged, afterTool, endSession, recordToolCall, sessionStartOutput, userPromptOutput } from "../adapters/process-hooks.js";
import { claudeProcessAdapter } from "../adapters/claude.js";
import { codexProcessAdapter } from "../adapters/codex.js";
import type { HookPayload, ProcessHookAdapter } from "../adapters/hook-payload.js";

function readPayload(): HookPayload {
  try {
    const parsed: unknown = JSON.parse(readFileSync(0, "utf8") || "{}");
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as HookPayload : {};
  } catch { return {}; }
}

function run(payload: HookPayload, adapter: ProcessHookAdapter): Record<string, unknown> {
  const event = typeof payload.hook_event_name === "string" ? payload.hook_event_name : "";
  recordToolCall(payload, adapter.harness);
  if (event === "PreToolUse") return adapter.preTool(payload);
  if (event === "SessionStart") return sessionStartOutput(payload, adapter.harness);
  if (event === "UserPromptSubmit") return userPromptOutput(payload);
  if (event === "PostCompact") afterCompact(payload);
  else if (event === "PostToolUse") afterTool(payload, adapter.harness);
  else if (event === "CwdChanged") afterCwdChanged(payload);
  else if (event === "FileChanged") afterFileChanged(payload);
  else if (event === "SessionEnd") endSession(payload, adapter.harness);
  return {};
}

try {
  const payload = readPayload();
  const adapter = process.env.DEVLOOP_HARNESS === "codex" ? codexProcessAdapter : claudeProcessAdapter;
  process.stdout.write(JSON.stringify(run(payload, adapter)));
} catch {
  // Process hooks are policy adapters: runtime defects must fail open.
  process.stdout.write("{}");
}

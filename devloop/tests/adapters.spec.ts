import type { Context } from "@deepseek-ai/cordis";
import type { PreToolDecision } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";
import { evaluateClaudePreTool } from "../adapters/claude.js";
import { apply } from "../adapters/dsh.js";
import { sessionStartOutput } from "../adapters/process-hooks.js";

describe("harness adapters", () => {
  it("maps Claude Code payloads into the shared guard", () => {
    const output = evaluateClaudePreTool({
      hook_event_name: "PreToolUse", tool_name: "Bash", cwd: process.cwd(), session_id: "s1",
      tool_input: { command: "git add -A" },
    });
    expect(output).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" } });
  });

  it("does not emit Claude-only watchPaths to Codex", () => {
    const output = sessionStartOutput({ hook_event_name: "SessionStart", cwd: process.cwd(), session_id: "s1" }, "codex");
    expect(JSON.stringify(output)).not.toContain("watchPaths");
  });

  it("registers the same guard natively in Cordis", async () => {
    const listeners = new Map<string, (...args: never[]) => unknown>();
    const ctx = {
      on: (event: string, value: (...args: never[]) => unknown) => { listeners.set(event, value); },
      logger: () => ({ warn: () => undefined }),
    } as unknown as Context;
    apply(ctx, { cwd: process.cwd() });
    const listener = listeners.get("tools/pre-execute") as unknown as
      ((exec: Record<string, unknown>, next: () => Promise<PreToolDecision>) => Promise<PreToolDecision>);
    expect(listener).toBeDefined();
    const result = await listener!({ name: "Bash", arguments: { command: "git add --all" } }, async () => ({ kind: "allow" }));
    expect(result).toMatchObject({ kind: "deny", reason: expect.stringContaining("broad `git add`") });
  });
});

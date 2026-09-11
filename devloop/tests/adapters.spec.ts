import { Context } from "@deepseek-ai/cordis";
import type { PreToolDecision } from "@deepseek-ai/dsh-tools";
import { describe, expect, it } from "vitest";
import * as dshPlugin from "../adapters/dsh.js";
import { claudeProcessAdapter, evaluateClaudePreTool } from "../adapters/claude.js";
import { codexProcessAdapter } from "../adapters/codex.js";
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

  it("keeps harness identity in the selected adapter instead of guessing from payload shape", () => {
    expect(claudeProcessAdapter.harness).toBe("claude");
    expect(codexProcessAdapter.harness).toBe("codex");
    expect(claudeProcessAdapter.preTool({ hook_event_name: "PreToolUse", model: "claude-opus-4-1" })).toEqual({});
  });

  it("registers the same guard natively in Cordis", async () => {
    const listeners = new Map<string, (...args: never[]) => unknown>();
    const ctx = {
      on: (event: string, value: (...args: never[]) => unknown) => { listeners.set(event, value); },
      logger: () => ({ warn: () => undefined }),
    } as unknown as Context;
    dshPlugin.apply(ctx, { cwd: process.cwd() });
    expect([...listeners.keys()]).toEqual([
      "agent/session-start",
      "agent/pre-step",
      "tools/pre-execute",
      "tools/post-execute",
      "agent/disposed",
    ]);
    const listener = listeners.get("tools/pre-execute") as unknown as
      ((exec: Record<string, unknown>, next: () => Promise<PreToolDecision>) => Promise<PreToolDecision>);
    expect(listener).toBeDefined();
    const result = await listener!({ name: "Bash", arguments: { command: "git add --all" } }, async () => ({ kind: "allow" }));
    expect(result).toMatchObject({ kind: "deny", reason: expect.stringContaining("broad `git add`") });
  });

  it("validates DSH bundle configuration while mounting", async () => {
    const ctx = new Context();
    await expect(ctx.plugin(dshPlugin, { cwd: 42 } as never)).rejects.toThrow();
    await ctx.fiber.dispose();
  });
});

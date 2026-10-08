import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { recordToolCall } from "../adapters/process-hooks.js";
import { acquireOwner, foreignOwner, readOwner, releaseOwner } from "../domain/context/session.js";

const roots: string[] = [];
function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("shared session state", () => {
  it("enforces one checkout owner across different harnesses", () => {
    const root = temporaryRoot("devloop-owner-");
    const claude = { harness: "claude", sessionId: "claude-session" } as const;
    const codex = { harness: "codex", sessionId: "codex-session" } as const;
    expect(acquireOwner(root, claude, "feature", 100, process.pid)).toBe(true);
    expect(readOwner(root)).toMatchObject({ harness: "claude", session_id: "claude-session" });
    expect(foreignOwner(root, codex.sessionId, codex.harness, 101)).toMatchObject({ harness: "claude" });
    expect(acquireOwner(root, codex, "feature", 101, process.pid)).toBe(false);
    expect(releaseOwner(root, codex)).toBe(false);
    expect(releaseOwner(root, claude)).toBe(true);
  });

  it("records tool timing from the TypeScript hook runtime", () => {
    const root = temporaryRoot("devloop-tools-");
    execFileSync("git", ["init", "-q", root]);
    const base = {
      tool_name: "Bash", tool_input: { command: "git status" }, cwd: root,
      session_id: "session", tool_use_id: "call-1",
    };
    recordToolCall({ ...base, hook_event_name: "PreToolUse" }, "codex");
    recordToolCall({ ...base, hook_event_name: "PostToolUse" }, "codex");
    const rows = readFileSync(join(root, ".devloop", "tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows).toMatchObject([
      { phase: "started", harness: "codex", call_id: "call-1" },
      { phase: "finished", harness: "codex", call_id: "call-1", outcome: "succeeded" },
    ]);
  });

  it("retains valid tool-call anchors when another observed path is unavailable", () => {
    const root = temporaryRoot("devloop-tool-anchors-");
    execFileSync("git", ["init", "-q", root]);
    recordToolCall({
      hook_event_name: "PreToolUse", tool_name: "Bash", cwd: root,
      tool_input: { command: "git status", path: join(root, "missing", "file.ts") },
      tool_use_id: "mixed-anchors",
    }, "claude");
    const rows = readFileSync(join(root, ".devloop", "tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows).toMatchObject([{ phase: "started", call_id: "mixed-anchors" }]);
  });

  // Codex shell/unified-exec headers and MCP CallToolResult use different wire formats.
  it.each([
    { name: "failed shell", tool: "Bash", response: "Exit code: 2\nWall time: 0.1 seconds\nOutput:\nfailed", outcome: "failed" },
    { name: "failed unified exec", tool: "Bash", response: "Chunk ID: abc\nWall time: 0.1 seconds\nProcess exited with code 1\nOutput:\nfailed", outcome: "failed" },
    { name: "failed patch", tool: "apply_patch", response: "Exit code: 1\nWall time: 0.1 seconds\nOutput:\npatch failed", outcome: "failed" },
    { name: "successful shell with failure text", tool: "Bash", response: "Exit code: 0\nWall time: 0.1 seconds\nOutput:\nExit code: 1\nProcess exited with code 2", outcome: "succeeded" },
    { name: "successful unified exec", tool: "Bash", response: "Wall time: 0.1 seconds\nProcess exited with code 0\nOutput:\nProcess exited with code 1", outcome: "succeeded" },
    { name: "successful direct patch", tool: "apply_patch", response: "Success. Updated the following files:\nM file.txt", outcome: "succeeded" },
    { name: "MCP error", tool: "mcp__example__check", response: { content: [], isError: true }, outcome: "failed" },
    { name: "MCP success", tool: "mcp__example__check", response: { content: [], isError: false }, outcome: "succeeded" },
    { name: "MCP success with omitted error flag", tool: "mcp__example__check", response: { content: [{ type: "text", text: "Exit code: 1" }] }, outcome: "succeeded" },
    { name: "unrelated function output", tool: "example", response: "Exit code: 1\nOutput:\nexample", outcome: "succeeded" },
  ])("records Codex $name without storing tool output", ({ tool, response, outcome }) => {
    const root = temporaryRoot("devloop-codex-outcome-");
    execFileSync("git", ["init", "-q", root]);
    const base = {
      tool_name: tool, tool_input: { command: "true" }, cwd: root,
      session_id: "session", tool_use_id: "call-result",
    };
    recordToolCall({ ...base, hook_event_name: "PreToolUse" }, "codex");
    recordToolCall({ ...base, hook_event_name: "PostToolUse", tool_response: response }, "codex");
    const rows = readFileSync(join(root, ".devloop", "tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ phase: "finished", outcome, call_id: "call-result", duration_ms: expect.any(Number) });
    expect(rows[1]).not.toHaveProperty("tool_response");
  });

  it.each(["claude", "dsh"] as const)("keeps %s outcomes based on its native event", (harness) => {
    const root = temporaryRoot("devloop-native-outcome-");
    execFileSync("git", ["init", "-q", root]);
    const base = { tool_name: "Bash", tool_input: { command: "true" }, cwd: root };
    recordToolCall({ ...base, hook_event_name: "PostToolUse", tool_response: "Exit code: 1\nOutput:\nexample" }, harness);
    recordToolCall({ ...base, hook_event_name: "PostToolUseFailure" }, harness);
    const rows = readFileSync(join(root, ".devloop", "tool-calls.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.map((row) => row.outcome)).toEqual(["succeeded", "failed"]);
  });
});

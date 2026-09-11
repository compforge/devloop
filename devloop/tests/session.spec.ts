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
});

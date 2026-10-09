import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerReconciliation } from "../domain/task-trigger.js";

let root: string;
let repo: string;
let plugin: string;
const task = "pr-lifecycle-reconcile";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(path: string): Promise<void> {
  for (let n = 0; n < 100 && !existsSync(path); n++) await pause(20);
  expect(existsSync(path), path).toBe(true);
}
function git(...args: string[]): string { return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim(); }
function tmp(name: string): string { return join(repo, ".devloop/tmp", `${task}.${name}`); }
function expire(): void { utimesSync(tmp("opportunistic"), new Date(0), new Date(0)); }

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-task-")));
  repo = join(root, "repo"); plugin = join(root, "plugin");
  mkdirSync(repo); mkdirSync(join(plugin, "tasks"), { recursive: true }); mkdirSync(join(plugin, "scripts"));
  git("init", "-q", "-b", "main"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.com");
  git("commit", "-qm", "base", "--allow-empty"); git("remote", "add", "origin", "https://example.com/team/repo.git");
  writeFileSync(join(plugin, "tasks/tasks.json"), JSON.stringify([{ name: task, interval_seconds: 120 }]));
  writeFileSync(join(plugin, "scripts/run_task.py"), "# entrypoint fixture");
  // The child records the exact command in the same place as the production task log.
  writeFileSync(join(plugin, "scripts/python"), `#!${process.execPath}
const fs = require('node:fs');
console.log(JSON.stringify(process.argv.slice(2)));
fs.writeFileSync('started', '');
setTimeout(() => fs.writeFileSync('finished', ''), 200);
`);
  chmodSync(join(plugin, "scripts/python"), 0o755);
  vi.stubEnv("PLUGIN_ROOT", plugin); vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
});
afterEach(async () => {
  if (existsSync(join(repo, "started"))) await waitFor(join(repo, "finished"));
  vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true });
});

describe("opportunistic reconciliation", () => {
  it("starts the shipped entrypoint without blocking and shares throttling across linked checkouts", async () => {
    const linked = join(root, "linked"); git("worktree", "add", "-qb", "feature", linked);
    expect(triggerReconciliation(linked)).toBe(true);
    expect(existsSync(join(repo, "finished"))).toBe(false);
    expect(triggerReconciliation(repo)).toBe(false);
    await waitFor(join(repo, "started"));
    expect(JSON.parse(readFileSync(tmp("log"), "utf8"))).toEqual([
      join(plugin, "scripts/run_task.py"), "run", task, repo, "--repo-only", "--report",
    ]);
    expire();
    // A still-running sweep stays protected even when its normal interval has elapsed.
    expect(triggerReconciliation(repo)).toBe(false);
    await waitFor(join(repo, "finished"));
  });

  it("recovers an abandoned claim and preserves child startup errors", async () => {
    mkdirSync(join(repo, ".devloop/tmp"), { recursive: true });
    writeFileSync(tmp("claim"), ""); utimesSync(tmp("claim"), new Date(0), new Date(0));
    writeFileSync(join(plugin, "scripts/python"), `#!${process.execPath}
console.error('task failed to start');
require('node:fs').writeFileSync('failed', '');
process.exitCode = 2;
`);
    expect(triggerReconciliation(repo)).toBe(true);
    await waitFor(join(repo, "failed"));
    expect(readFileSync(tmp("log"), "utf8")).toContain("task failed to start");
  });

  it("reports a missing runner without claiming successful startup", () => {
    rmSync(join(plugin, "scripts/run_task.py"));
    expect(triggerReconciliation(repo)).toBe(false);
    expect(existsSync(tmp("opportunistic"))).toBe(false);
    expect(readFileSync(join(repo, ".devloop/tasks.jsonl"), "utf8")).toContain("missing task entrypoint");
  });

  it("starts from the installed Codex PostToolUse bundle when cwd is a workspace", async () => {
    mkdirSync(join(plugin, "dist/hooks"), { recursive: true });
    copyFileSync(new URL("../dist/hooks/runtime.js", import.meta.url), join(plugin, "dist/hooks/runtime.mjs"));
    const result = execFileSync(process.execPath, [join(plugin, "dist/hooks/runtime.mjs")], {
      cwd: root, encoding: "utf8", timeout: 10_000,
      env: { ...process.env, DEVLOOP_HARNESS: "codex" },
      input: JSON.stringify({ hook_event_name: "PostToolUse", cwd: root, tool_name: "exec_command",
        tool_input: { cmd: "git status --short", workdir: repo } }),
    });
    expect(JSON.parse(result)).toEqual({});
    await waitFor(join(repo, "started"));
    expect(JSON.parse(readFileSync(tmp("log"), "utf8"))[0]).toBe(join(plugin, "scripts/run_task.py"));
  });

  it("starts from the installed Codex SessionStart bundle", async () => {
    mkdirSync(join(plugin, "dist/hooks"), { recursive: true });
    copyFileSync(new URL("../dist/hooks/runtime.js", import.meta.url), join(plugin, "dist/hooks/runtime.mjs"));
    execFileSync(process.execPath, [join(plugin, "dist/hooks/runtime.mjs")], {
      cwd: repo, encoding: "utf8", timeout: 10_000,
      env: { ...process.env, DEVLOOP_HARNESS: "codex" },
      input: JSON.stringify({ hook_event_name: "SessionStart", cwd: repo, session_id: "task-test" }),
    });
    await waitFor(join(repo, "started"));
  });
});

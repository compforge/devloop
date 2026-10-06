import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

// Exercise the artifact used by Git marketplace installations, which have no node_modules.
describe("standalone process hook", () => {
  it.each(["claude", "codex"])("awaits native inspection and preserves %s gate decisions without npm dependencies", (harness) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-hook-bundle-"))); roots.push(root);
    const entry = join(root, "runtime.mjs");
    copyFileSync(new URL("../dist/hooks/runtime.js", import.meta.url), entry);
    execFileSync("git", ["init", "-q", "-b", "feature", root]);
    mkdirSync(join(root, ".devloop"));
    writeFileSync(join(root, ".devloop/config.json"), JSON.stringify({ lifecycle: { default: { pre_commit: ["lint"] } } }));
    writeFileSync(join(root, "go.mod"), "module example.com/service\n");
    writeFileSync(join(root, "Makefile"), "lint:\n\t@true\n");
    const run = () => {
      const result = spawnSync(process.execPath, [entry], {
        cwd: root, encoding: "utf8", timeout: 10_000,
        env: { ...process.env, NODE_PATH: "", DEVLOOP_HARNESS: harness, DEVLOOP_CONFIG_DIR: join(root, "config"), DEVLOOP_REPOCLI: join(root, "missing-repocli"), PLUGIN_ROOT: root },
        input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: harness === "codex" ? "exec_command" : "Bash", cwd: root, session_id: "bundle", tool_input: harness === "codex" ? { cmd: "git commit -m test", workdir: root } : { command: "git commit -m test" } }),
      });
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout);
    };
    expect(run()).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny", permissionDecisionReason: expect.stringContaining("lint has never run") } });
    writeFileSync(join(root, ".repocli.json"), JSON.stringify({ components: [{ name: "bad", root: "../outside" }] }));
    expect(run()).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny", permissionDecisionReason: expect.stringContaining("inspection unavailable") } });
  });
});

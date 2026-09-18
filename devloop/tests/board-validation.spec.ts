import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userPromptOutput } from "../adapters/process-hooks.js";
import { branchSegment, saveSegment } from "../domain/context/store.js";

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-validation-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  execFileSync("git", ["init", "-q", "-b", "feature", root]);
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

it("delivers full fallback reason from persisted state to the prompt", () => {
  saveSegment(root, branchSegment("feature", "validation_scope"), {
    snapshot: "", checks: [{ component: "server", check: "test", scope: "full", reason: "repocli fallback: CLI unavailable" }],
  });
  const output = JSON.stringify(userPromptOutput({ cwd: root, session_id: "validation-session" }));
  expect(output).toContain("server test=full");
  expect(output).toContain("repocli fallback: CLI unavailable");
  expect(output).not.toContain("stamped");
});

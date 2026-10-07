import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

it("delivers full fallback reason from persisted state to the prompt", async () => {
  saveSegment(root, branchSegment("feature", "validation_scope"), {
    snapshot: "", checks: [{ component: "server", check: "test", scope: "full", reason: "repocli fallback: CLI unavailable" }],
  });
  const output = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "validation-session" }));
  expect(output).toContain("server test=full");
  expect(output).toContain("repocli fallback: CLI unavailable");
  expect(output).not.toContain("stamped");
});

it("shows missing lint as non-blocking and clears it when the entry is added", async () => {
  writeFileSync(join(root, "go.mod"), "module example.test/demo\n\ngo 1.24\n");
  const output = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "missing-lint" }));
  expect(output).toContain("Lint unavailable: .");
  expect(output).toContain("non-blocking");
  expect(output).toContain("no recorded runs");
  writeFileSync(join(root, "Makefile"), "lint:\n\t@true\n");
  const updated = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "with-lint" }));
  expect(updated).not.toContain("Lint unavailable");
});

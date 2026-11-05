import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userPromptOutput } from "../adapters/process-hooks.js";
import { branchSegment, loadSegment, saveSegment } from "../domain/context/store.js";

let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-validation-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  execFileSync("git", ["init", "-q", "-b", "feature", root]);
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

// @case Legacy passing evidence and scope must not become current Board validation facts.
it.each([false, true])("does not infer validation history from legacy records (present=%s)", async (present) => {
  const checkedAt = "2026-01-01T00:00:00Z";
  const segment = "validation_results/" + createHash("sha256").update(`${root}\0.\0lint`).digest("hex");
  const record = { eligible: true, checked_at: checkedAt, report: {
    schemaVersion: 2, inputsConsistent: true, checkout: root, snapshot: "legacy-snapshot",
    components: [{ component: { root: "." }, checks: [{ check: "lint", scope: "full", status: "passed", checkedAt }] }],
  } };
  if (present) {
    saveSegment(root, segment, record);
    saveSegment(root, branchSegment("feature", "lint"), { ".": { evidence: segment, checked_at: checkedAt } });
    saveSegment(root, branchSegment("feature", "validation_scope"), {
      checks: [{ component: "server", check: "test", scope: "full", reason: "obsolete fallback" }],
    });
  }
  const output = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "validation-session" }));
  expect(output).toContain("[Current repo:");
  expect(output).not.toMatch(/Validation|validation scope|obsolete fallback|legacy-snapshot/);
  expect(loadSegment(root, segment)).toEqual(present ? record : undefined);
});

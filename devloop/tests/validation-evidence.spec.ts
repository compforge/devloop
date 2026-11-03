import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { branchSegment, saveSegment } from "../domain/context/store.js";
import { evidenceSegment, fullEvidence, fullProjection, reusableFullEvidence } from "../domain/validation-evidence.js";
import { inspectCatalog } from "../domain/repo-layout.js";
import { componentFingerprint } from "../domain/repo.js";
import { RULES } from "../hooks/rules/index.js";
import { PolicyContext } from "../hooks/core/context.js";
import type { CommandTarget } from "../hooks/core/domain.js";
import type { JsonObject } from "../lib/config.js";

let repo: string;
beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), "devloop-evidence-")));
  execFileSync("git", ["init", "-q", "-b", "feature", repo]);
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(repo, { recursive: true, force: true }); });

const checkedAt = "2026-11-01T12:00:00Z";
function record(): JsonObject {
  return { eligible: true, checked_at: checkedAt, report: {
    schemaVersion: 2, snapshot: "source", checkout: repo, inputsConsistent: true,
    components: [{ component: { root: "." }, checks: [{ check: "lint", status: "passed", scope: "full",
      checkedAt, environment: "frozen-check-environment", witnesses: {} }] }],
  } };
}
function check(evidence: JsonObject): JsonObject {
  return (((evidence.report as JsonObject).components as JsonObject[])[0]!.checks as JsonObject[])[0]!;
}

it("shares original-report evidence semantics with Python", () => {
  const contract = JSON.parse(readFileSync(new URL("./fixtures/validation-evidence.json", import.meta.url), "utf8"));
  const segment = evidenceSegment(repo, ".", "lint");
  for (const item of contract.cases) {
    const original = record();
    Object.assign(check(original), item.result);
    Object.assign(original.report as JsonObject, item.report);
    Object.assign(original, item.record);
    saveSegment(repo, segment, original);
    expect(Boolean(fullEvidence(repo, ".", "lint", { evidence: segment, checked_at: checkedAt, ...item.reference })), item.name).toBe(item.valid);
  }
});

it("projects branch references to the original execution and rejects replaced evidence", () => {
  const segment = evidenceSegment(repo, ".", "lint");
  saveSegment(repo, segment, record());
  for (const branch of ["feature", "next"]) {
    saveSegment(repo, branchSegment(branch, "lint"), { ".": { evidence: segment, checked_at: checkedAt } });
    expect(fullProjection(repo, branch, "lint")).toEqual({ ".": { passed_at: Date.parse(checkedAt) / 1000, fingerprint: "source" } });
  }
  saveSegment(repo, segment, { ...record(), eligible: false });
  expect(fullProjection(repo, "feature", "lint")).toEqual({});
  expect(fullProjection(repo, "next", "lint")).toEqual({});
});

it("checks current contents and receipts without comparing the Harness environment", () => {
  const evidence = record();
  expect(reusableFullEvidence(evidence, "source")).toBe(true);
  check(evidence).inputs = { disableReuse: true };
  expect(reusableFullEvidence(evidence, "source")).toBe(false);
  check(evidence).inputs = {};
  const receipt = join(repo, "receipt");
  writeFileSync(receipt, "ready");
  check(evidence).witnesses = { [receipt]: createHash("sha256").update("ready").digest("hex") };
  vi.stubEnv("VIRTUAL_ENV", "/different-harness-runtime");
  expect(reusableFullEvidence(evidence, "source")).toBe(true);
  expect(reusableFullEvidence(evidence, "changed")).toBe(false);
  writeFileSync(receipt, "changed");
  expect(reusableFullEvidence(evidence, "source")).toBe(false);
  rmSync(receipt);
  expect(reusableFullEvidence(evidence, "source")).toBe(false);
});

it("allows the staged verified tree, then denies omitted edits and commit path operands", async () => {
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(repo, "config"));
  mkdirSync(join(repo, ".devloop"));
  writeFileSync(join(repo, ".devloop/config.json"), JSON.stringify({ lifecycle: { default: { pre_commit: ["lint"] } } }));
  writeFileSync(join(repo, ".gitignore"), ".devloop/\n");
  writeFileSync(join(repo, "go.mod"), "module example.com/check\n");
  writeFileSync(join(repo, "Makefile"), "lint:\n\t@true\n");
  execFileSync("git", ["-C", repo, "add", ".gitignore", "go.mod", "Makefile"]);
  const catalog = await inspectCatalog(repo);
  const fingerprint = await componentFingerprint(repo, catalog.components[0]!, catalog);
  expect(fingerprint).toBeTruthy();
  const evidence = record();
  (evidence.report as JsonObject).snapshot = fingerprint!;
  const segment = evidenceSegment(repo, ".", "lint");
  saveSegment(repo, segment, evidence);
  saveSegment(repo, branchSegment("feature", "lint"), { ".": { evidence: segment, checked_at: checkedAt } });
  const context = new PolicyContext(repo, { harness: "codex", sessionId: "test" });
  const rule = RULES.find((item) => item.name === "precommit-gate")!;
  const target: CommandTarget = { kind: "command", argv: ["git", "commit", "-m", "test"], args: ["-m", "test"],
    environment: [], subcommand: "commit", workingDirectory: { path: repo, source: "test" } };
  expect(await rule.check(target, context)).toEqual([]);
  for (const args of [["go.mod", "-m", "test"], ["--only", "go.mod"], ["-am", "test"]]) {
    expect(await rule.check({ ...target, args }, context)).not.toEqual([]);
  }
  writeFileSync(join(repo, "Makefile"), "lint:\n\t@false\n");
  expect(await rule.check(target, context)).not.toEqual([]);
});

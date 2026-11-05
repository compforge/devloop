import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { branchSegment, saveSegment } from "../domain/context/store.js";
import { evidenceSegment, fullEvidence, fullProjection, reusableFullEvidence } from "../domain/validation-evidence.js";
import { RULES } from "../hooks/rules/index.js";
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

it("does not use validation evidence to deny commands", () => {
  expect(RULES.some((rule) => rule.name === "precommit-gate" || rule.name === "pytest-naked")).toBe(false);
});

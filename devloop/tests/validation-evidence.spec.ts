import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { branchSegment, saveSegment } from "../domain/context/store.js";
import { environmentIdentity, evidenceSegment, fullEvidence, fullProjection, reusableFullEvidence } from "../domain/validation-evidence.js";
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

function record(): JsonObject {
  return { status: "passed", checked_at: 100, identity: {
    version: 2, checkout: repo, component: ".", check: "lint", scope: "full", fingerprint: "source",
    environment: environmentIdentity(), command: ["make", "lint", "LINT_FILES="], dependencies: [],
  } };
}

it("uses the same evidence and environment contract as Python workflows", () => {
  const contract = JSON.parse(readFileSync(new URL("./fixtures/validation-evidence.json", import.meta.url), "utf8"));
  expect(environmentIdentity(contract.environment)).toBe(contract.environmentHash);
  const segment = evidenceSegment(repo, ".", "lint");
  for (const item of contract.cases) {
    const original = record();
    saveSegment(repo, segment, { ...original, identity: { ...original.identity as JsonObject, ...item.identity }, ...item.record });
    const reference = { evidence: segment, checked_at: 100, ...item.reference };
    expect(Boolean(fullEvidence(repo, ".", "lint", reference)), item.name).toBe(item.valid);
  }
});

it("projects both branches from the original run and rejects replaced evidence", () => {
  const segment = evidenceSegment(repo, ".", "lint");
  saveSegment(repo, segment, record());
  for (const branch of ["feature", "next"]) {
    saveSegment(repo, branchSegment(branch, "lint"), { ".": { evidence: segment, checked_at: 100 } });
    expect(fullProjection(repo, branch, "lint")).toEqual({ ".": { passed_at: 100, fingerprint: "source" } });
  }
  saveSegment(repo, segment, { ...record(), status: "failed" });
  expect(fullProjection(repo, "feature", "lint")).toEqual({});
  expect(fullProjection(repo, "next", "lint")).toEqual({});
});

it("requires known dependency witnesses, the same command and current process environment", () => {
  const evidence = record();
  const identity = evidence.identity as JsonObject;
  const command = ["make", "lint", "LINT_FILES="];
  expect(reusableFullEvidence(evidence, "source", command)).toBe(true);
  identity.dependencies = null;
  expect(reusableFullEvidence(evidence, "source", command)).toBe(false);
  const receipt = join(repo, "receipt");
  writeFileSync(receipt, "ready");
  identity.dependencies = [[receipt, createHash("sha256").update("ready").digest("hex")]];
  expect(reusableFullEvidence(evidence, "source", command)).toBe(true);
  expect(reusableFullEvidence(evidence, "changed", command)).toBe(false);
  expect(reusableFullEvidence(evidence, "source", ["make", "lint-ci"])).toBe(false);
  identity.environment = "different";
  expect(reusableFullEvidence(evidence, "source", command)).toBe(false);
  identity.environment = environmentIdentity();
  writeFileSync(receipt, "changed");
  expect(reusableFullEvidence(evidence, "source", command)).toBe(false);
  rmSync(receipt);
  expect(reusableFullEvidence(evidence, "source", command)).toBe(false);
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
  (evidence.identity as JsonObject).fingerprint = fingerprint!;
  const segment = evidenceSegment(repo, ".", "lint");
  saveSegment(repo, segment, evidence);
  saveSegment(repo, branchSegment("feature", "lint"), { ".": { evidence: segment, checked_at: 100 } });
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

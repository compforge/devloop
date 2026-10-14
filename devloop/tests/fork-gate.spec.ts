import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { evaluateGate } from "../domain/context/gate.js";
import { saveSegment } from "../domain/context/store.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it("keeps another fork's same-named branch out of the write gate", () => {
  const repo = mkdtempSync(join(tmpdir(), "devloop-fork-gate-")); roots.push(repo);
  execFileSync("git", ["init", "-q", "-b", "fix"], { cwd: repo });
  execFileSync("git", ["remote", "add", "origin", "git@github.com:Fork/Repo.git"], { cwd: repo });
  const own = { number: 8, state: "open", source_branch: "fix", source_repository: "fork/repo" };
  const foreign = { number: 9, state: "open", source_branch: "fix", source_repository: "other/repo" };
  saveSegment(repo, "pr", { branch: "fix", provider: "github", source_repository: "fork/repo", pr_number: 8, prs: [foreign, own] });
  expect(evaluateGate(repo).activePullRequest?.number).toBe(8);
  saveSegment(repo, "pr", { branch: "fix", provider: "github", source_repository: "fork/repo", pr_number: null, prs: [foreign] });
  expect(evaluateGate(repo).activePullRequest).toBeUndefined();
});

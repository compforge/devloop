import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { gitPath, runGit, targetExists } from "@compforge/repocli";
export { currentBranch, aheadBehind, workspaceStatus, revParse, headSha, targetExists, refreshRemoteHead, setLocalDefaultHead, isAncestor, upstreamAheadBehind, remoteTips, listCheckouts, checkoutInfo, mainRepoRoot, localBranches, fetchRemote } from "@compforge/repocli";
export type { WorkspaceStatus, CheckoutEntry } from "@compforge/repocli";
const PROTECTED_BRANCHES = [/^main$/, /^master$/, /^release$/, /^release.*/, /.*release$/];

export function isProtectedBranch(branch?: string): boolean {
  return branch !== undefined && PROTECTED_BRANCHES.some((pattern) => pattern.test(branch));
}

export function localDefaultTarget(repo: string): string {
  const result = runGit(repo, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  if (!result.ok && result.code !== 1) throw new Error(`cannot read default branch reference: ${result.stderr}`);
  const prefix = "refs/remotes/origin/";
  if (result.ok && result.stdout.startsWith(prefix)) return result.stdout.slice(prefix.length);
  if (targetExists(repo, "main")) return "main";
  if (targetExists(repo, "master")) return "master";
  return "main";
}

export function ensureGitExclude(repo: string, pattern = "/.devloop/"): void {
  try {
    const path = gitPath(repo, "info/exclude");
    mkdirSync(dirname(path), { recursive: true });
    const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (existing.split("\n").some((line) => line.trim() === pattern.trim())) return;
    appendFileSync(path, `${existing && !existing.endsWith("\n") ? "\n" : ""}${pattern}\n`, "utf8");
  } catch {
    // Runtime exclusion is best-effort; guards still ignore the namespace explicitly.
  }
}

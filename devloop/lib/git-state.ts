import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runGit } from "./process.js";

const PROTECTED_BRANCHES = [/^main$/, /^master$/, /^release$/, /^release.*/, /.*release$/];

export interface WorkspaceStatus {
  readonly dirty: boolean;
  readonly modifiedCount: number;
  readonly untrackedCount: number;
}

export interface WorktreeEntry {
  readonly path: string;
  readonly sha: string;
  readonly branch?: string;
}

export function currentBranch(repo: string): string | undefined {
  const result = runGit(repo, ["branch", "--show-current"]);
  return result.ok && result.stdout ? result.stdout : undefined;
}

export function isProtectedBranch(branch?: string): boolean {
  return branch !== undefined && PROTECTED_BRANCHES.some((pattern) => pattern.test(branch));
}

export function aheadBehind(repo: string, target = "main"): readonly [ahead: number, behind: number] | undefined {
  const ahead = runGit(repo, ["rev-list", "--count", `origin/${target}..HEAD`]);
  const behind = runGit(repo, ["rev-list", "--count", `HEAD..origin/${target}`]);
  if (!ahead.ok || !behind.ok) return undefined;
  const values = [Number.parseInt(ahead.stdout, 10), Number.parseInt(behind.stdout, 10)] as const;
  return values.every(Number.isFinite) ? values : undefined;
}

export function workspaceStatus(repo: string): WorkspaceStatus {
  const result = runGit(repo, ["status", "--porcelain"]);
  if (!result.ok) return { dirty: false, modifiedCount: 0, untrackedCount: 0 };
  const lines = result.stdout.split("\n").filter(Boolean);
  return {
    dirty: lines.length > 0,
    modifiedCount: lines.filter((line) => !line.startsWith("??")).length,
    untrackedCount: lines.filter((line) => line.startsWith("??")).length,
  };
}

export function revParse(repo: string, ref: string): string {
  const result = runGit(repo, ["rev-parse", "--verify", "--quiet", ref]);
  return result.ok ? result.stdout : "";
}

export function headSha(repo: string): string {
  const result = runGit(repo, ["rev-parse", "HEAD"]);
  return result.ok ? result.stdout : "";
}

export function targetExists(repo: string, target = "main"): boolean {
  return revParse(repo, `origin/${target}`) !== "";
}

export function localDefaultTarget(repo: string): string {
  const result = runGit(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  const prefix = "refs/remotes/origin/";
  if (result.ok && result.stdout.startsWith(prefix)) return result.stdout.slice(prefix.length);
  if (targetExists(repo, "main")) return "main";
  if (targetExists(repo, "master")) return "master";
  return "main";
}

export function refreshRemoteHead(repo: string, timeoutMs = 5_000): boolean {
  return runGit(repo, ["remote", "set-head", "origin", "--auto"], timeoutMs).ok;
}

export function setLocalDefaultHead(repo: string, branch: string): boolean {
  return branch !== "" && runGit(repo, ["symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${branch}`]).ok;
}

export function isAncestor(repo: string, ancestor?: string, descendant?: string): boolean {
  if (!ancestor || !descendant) return false;
  return ancestor === descendant || runGit(repo, ["merge-base", "--is-ancestor", ancestor, descendant]).code === 0;
}

export function upstreamAheadBehind(repo: string): readonly [ahead: number, behind: number] | undefined {
  const result = runGit(repo, ["rev-list", "--count", "--left-right", "@{upstream}...HEAD"]);
  const [behindRaw, aheadRaw] = result.stdout.split("\t");
  if (!result.ok || behindRaw === undefined || aheadRaw === undefined) return undefined;
  const ahead = Number.parseInt(aheadRaw, 10);
  const behind = Number.parseInt(behindRaw, 10);
  return Number.isFinite(ahead) && Number.isFinite(behind) ? [ahead, behind] : undefined;
}

export function remoteTips(repo: string, branches: readonly string[], timeoutMs = 5_000): ReadonlyMap<string, string> {
  if (branches.length === 0) return new Map();
  const result = runGit(repo, ["ls-remote", "origin", ...branches], timeoutMs);
  const tips = new Map<string, string>();
  if (!result.ok) return tips;
  for (const line of result.stdout.split("\n")) {
    const [sha, ref] = line.split("\t");
    if (sha && ref?.startsWith("refs/heads/")) tips.set(ref.slice("refs/heads/".length), sha);
  }
  return tips;
}

export function listWorktrees(repo: string): readonly WorktreeEntry[] {
  const result = runGit(repo, ["worktree", "list", "--porcelain"]);
  if (!result.ok || !result.stdout) return [];
  const entries: WorktreeEntry[] = [];
  for (const block of result.stdout.split("\n\n")) {
    let path = "";
    let sha = "";
    let branch: string | undefined;
    for (const line of block.split("\n")) {
      if (line.startsWith("worktree ")) path = line.slice(9).trim();
      else if (line.startsWith("HEAD ")) sha = line.slice(5).trim();
      else if (line.startsWith("branch ")) branch = line.slice(7).trim().replace(/^refs\/heads\//, "");
    }
    if (path) entries.push({ path, sha, ...(branch ? { branch } : {}) });
  }
  return entries;
}

export function worktreeMetadata(repo: string): { readonly linked: boolean; readonly commonDir: string; readonly mainBranch?: string } {
  const gitDir = runGit(repo, ["rev-parse", "--git-dir"]);
  const commonDir = runGit(repo, ["rev-parse", "--git-common-dir"]);
  if (!gitDir.ok || !commonDir.ok || !gitDir.stdout || !commonDir.stdout) return { linked: false, commonDir: "" };
  const resolvedGit = resolve(repo, gitDir.stdout);
  const resolvedCommon = resolve(repo, commonDir.stdout);
  if (resolvedGit === resolvedCommon) return { linked: false, commonDir: "" };
  const mainBranch = listWorktrees(repo)[0]?.branch;
  return { linked: true, commonDir: resolvedCommon, ...(mainBranch ? { mainBranch } : {}) };
}

export function localBranches(repo: string): ReadonlyMap<string, string> {
  const result = runGit(repo, ["for-each-ref", "--sort=refname", "--format=%(refname:short)%00%(objectname)", "refs/heads"]);
  const branches = new Map<string, string>();
  if (!result.ok) return branches;
  for (const line of result.stdout.split("\n")) {
    const [name, sha] = line.split("\0");
    if (name && sha) branches.set(name, sha);
  }
  return branches;
}

export function fetchRemote(repo: string, refs: readonly string[] = [], timeoutMs = 8_000): boolean {
  return runGit(repo, ["fetch", "origin", ...refs, "--quiet"], timeoutMs).ok;
}

/** Keep runtime state local without editing the repository's committed ignore file. */
export function ensureGitExclude(repo: string, pattern = "/.devloop/"): void {
  const result = runGit(repo, ["rev-parse", "--git-path", "info/exclude"]);
  if (!result.ok || !result.stdout) return;
  const path = resolve(repo, result.stdout);
  try {
    mkdirSync(dirname(path), { recursive: true });
    const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (existing.split("\n").some((line) => line.trim() === pattern.trim())) return;
    appendFileSync(path, `${existing && !existing.endsWith("\n") ? "\n" : ""}${pattern}\n`, "utf8");
  } catch {
    // Runtime exclusion is best-effort; guards still ignore the namespace explicitly.
  }
}

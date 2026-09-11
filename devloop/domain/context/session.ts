import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { currentBranch, ensureGitExclude } from "../../lib/git-state.js";
import { now } from "./base.js";
import { appendLedger, stateDirectory, workingTreeStateDirectory } from "./store.js";
import { ACTIVE_REPO_TTL_SECONDS } from "./base.js";

export const OWNER_TTL_SECONDS = 1_800;

export interface SessionIdentity { readonly harness: "claude" | "codex" | "dsh" | "unknown"; readonly sessionId: string }
export interface OwnerRecord { readonly harness: string; readonly session_id: string; readonly pid: number; readonly branch: string; readonly acquired_at: number }

export function identityFromEnvironment(): SessionIdentity {
  const codex = process.env.CODEX_THREAD_ID ?? process.env.CODEX_SESSION_ID;
  if (codex) return { harness: "codex", sessionId: codex };
  if (process.env.CLAUDE_CODE_SESSION_ID) return { harness: "claude", sessionId: process.env.CLAUDE_CODE_SESSION_ID };
  return { harness: "unknown", sessionId: "" };
}

function safeHarness(harness: string): string { return harness.trim().toLowerCase().replace(/[^A-Za-z0-9._-]/g, "-") || "unknown"; }
function lockFile(repo: string): string { return join(workingTreeStateDirectory(repo), "owner.lock"); }
function legacyLockFile(repo: string, harness: string): string { return join(workingTreeStateDirectory(repo), `${safeHarness(harness)}.owner.lock`); }

function readOwnerFile(path: string): OwnerRecord | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as OwnerRecord : undefined;
  } catch { return undefined; }
}

export function readOwner(repo: string): OwnerRecord | undefined { return readOwnerFile(lockFile(repo)); }

function pidAlive(pid: unknown): boolean {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}

function active(owner: OwnerRecord | undefined, at: number): boolean {
  return owner !== undefined && (pidAlive(owner.pid) || at - owner.acquired_at < OWNER_TTL_SECONDS);
}

export function foreignOwner(repo: string, sessionId: string, harness = "claude", at = now()): OwnerRecord | undefined {
  const owner = anyActiveOwner(repo, at);
  return owner && (owner.session_id !== sessionId || owner.harness !== safeHarness(harness)) ? owner : undefined;
}

export function anyActiveOwner(repo: string, at = now()): OwnerRecord | undefined {
  const current = readOwner(repo);
  if (active(current, at)) return current;
  try {
    for (const name of readdirSync(workingTreeStateDirectory(repo))) {
      if (!name.endsWith(".owner.lock")) continue;
      const owner = readOwnerFile(join(workingTreeStateDirectory(repo), name));
      if (active(owner, at)) return owner;
    }
  } catch { /* no state directory */ }
  return undefined;
}

/** First active session wins checkout ownership; I/O failure remains fail-open. */
export function acquireOwner(repo: string, identity: SessionIdentity, branch = currentBranch(repo) ?? "", at = now(), pid = process.ppid): boolean {
  if (!identity.sessionId) return true;
  const harness = safeHarness(identity.harness);
  const path = lockFile(repo);
  const record: OwnerRecord = { harness, session_id: identity.sessionId, pid, branch, acquired_at: at };
  const owner = anyActiveOwner(repo, at);
  if (owner?.session_id === identity.sessionId && owner.harness === harness) {
    try {
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(record)); renameSync(temporary, path);
      try { unlinkSync(legacyLockFile(repo, harness)); } catch { /* already migrated */ }
    } catch { /* best-effort refresh */ }
    return true;
  }
  if (owner) return false;
  try {
    ensureGitExclude(repo);
    mkdirSync(workingTreeStateDirectory(repo), { recursive: true });
    if (existsSync(path)) unlinkSync(path);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const descriptor = openSync(path, "wx", 0o644);
        writeFileSync(descriptor, JSON.stringify(record)); closeSync(descriptor);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const current = readOwner(repo);
        if (current) return current.session_id === identity.sessionId && current.harness === harness;
        try { unlinkSync(path); } catch { /* retry once */ }
      }
    }
    return false;
  } catch { return true; }
}

export function releaseOwner(repo: string, identity: SessionIdentity): boolean {
  if (!identity.sessionId) return false;
  const harness = safeHarness(identity.harness);
  let released = false;
  const current = readOwner(repo);
  if (current?.session_id === identity.sessionId && current.harness === harness) {
    try { unlinkSync(lockFile(repo)); released = true; } catch { /* already absent */ }
  }
  const legacy = readOwnerFile(legacyLockFile(repo, harness));
  if (legacy?.session_id === identity.sessionId) {
    try { unlinkSync(legacyLockFile(repo, harness)); released = true; } catch { /* already absent */ }
  }
  return released;
}

export function ownerDescription(owner: OwnerRecord): string {
  return `branch '${owner.branch || "?"}', session ${owner.session_id.slice(0, 8)}...`;
}

export function repositoryName(repo: string): string { return basename(repo); }

export function sessionName(sessionId?: string): string {
  return (sessionId ?? identityFromEnvironment().sessionId).replace(/[^A-Za-z0-9._-]/g, "-") || "anon";
}

function activeRepoFile(workspaceRoot: string, sessionId?: string): string {
  return join(stateDirectory(workspaceRoot), "active", `${sessionName(sessionId)}.json`);
}

function activeBinding(path: string, enforceTtl: boolean): { readonly repo: string; readonly age: number } | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const row = value as Record<string, unknown>;
    if (typeof row.repo_dir !== "string" || !existsSync(row.repo_dir)) return undefined;
    const timestamp = typeof row.ts === "number" ? row.ts : statSync(path).mtimeMs / 1_000;
    const age = Math.max(0, now() - timestamp);
    return enforceTtl && age >= ACTIVE_REPO_TTL_SECONDS ? undefined : { repo: row.repo_dir, age };
  } catch { return undefined; }
}

export function recordActiveRepo(workspaceRoot: string, repo: string, sessionId?: string): void {
  const path = activeRepoFile(workspaceRoot, sessionId);
  try {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify({ repo_dir: resolve(repo), ts: now() }));
    renameSync(temporary, path);
  } catch { /* derived session binding */ }
}

export function loadActiveRepo(workspaceRoot: string, sessionId?: string): string | undefined {
  return activeBinding(activeRepoFile(workspaceRoot, sessionId), true)?.repo;
}

export function loadActiveRepoLenient(workspaceRoot: string, sessionId?: string): { readonly repo: string; readonly age: number } | undefined {
  return activeBinding(activeRepoFile(workspaceRoot, sessionId), false);
}

export function clearActiveRepo(workspaceRoot: string, sessionId?: string): void {
  try { unlinkSync(activeRepoFile(workspaceRoot, sessionId)); } catch { /* already absent */ }
}

export function recordSessionEvent(repo: string, sessionId: string | undefined, kind: string, fields: Record<string, unknown> = {}): void {
  appendLedger(repo, `sessions/${sessionName(sessionId)}`, { ts: Math.round(now() * 10) / 10, kind, ...fields });
}

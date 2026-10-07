import { checkoutInfo } from "@compforge/repocli";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import type { JsonObject } from "../../lib/config.js";

export const STATE_DIRECTORY_NAME = ".devloop";
export const WORKSPACE_STATE_FILE = "context.json";

const stateRoots = new Map<string, { readonly marker: string; readonly home: string }>();

function sharedStateRoot(root: string): string {
  const path = join(root, ".git");
  if (!existsSync(path)) return root;
  const metadata = statSync(path);
  const marker = `${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}`;
  const cached = stateRoots.get(root);
  if (cached?.marker === marker) return cached.home;
  // Metadata without a main-checkout backlink is still a stable shared state home.
  // Query errors must not silently redirect state to a different checkout.
  const info = checkoutInfo(root);
  const home = info.mainRoot ?? info.commonDir;
  // Reuse topology across segment reads, invalidating when Git replaces/repairs the marker.
  if (stateRoots.size >= 64) stateRoots.delete(stateRoots.keys().next().value!);
  stateRoots.set(root, { marker, home });
  return home;
}

export function stateDirectory(root: string): string { return join(sharedStateRoot(resolve(root)), STATE_DIRECTORY_NAME); }
export function workingTreeStateDirectory(root: string): string { return join(resolve(root), STATE_DIRECTORY_NAME); }
export function commitMessageFile(root: string): string { return join(workingTreeStateDirectory(root), "commit_msg"); }
export function temporaryDirectory(root: string): string { return join(stateDirectory(root), "tmp"); }
export function branchSegment(branch: string | undefined, name: string): string { return `branches/${branch ?? "@detached"}/${name}`; }
export function workspaceStateFile(root: string): string { return join(stateDirectory(root), WORKSPACE_STATE_FILE); }
export function segmentFile(root: string, name: string): string { return join(stateDirectory(root), `${name}.json`); }

function atomicWrite(path: string, data: JsonObject): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = join(dirname(path), `${parse(path).base}.${process.pid}.tmp`);
    writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
    renameSync(temporary, path);
  } catch {
    // Context is a derived cache; the next refresh can reconstruct it.
  }
}

function readJson(path: string): JsonObject | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
  } catch { return undefined; }
}

export function loadWorkspace(root: string): JsonObject | undefined { return readJson(workspaceStateFile(root)); }
export function saveWorkspace(root: string, data: JsonObject): void { atomicWrite(workspaceStateFile(root), data); }
export function loadSegment(root: string, name: string): JsonObject | undefined { return readJson(segmentFile(root, name)); }
export function saveSegment(root: string, name: string, data: JsonObject): void { atomicWrite(segmentFile(root, name), data); }

export function appendLedger(root: string, name: string, record: JsonObject): void {
  try {
    const path = join(stateDirectory(root), `${name}.jsonl`);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    // Ledgers are observability and never gate the harness action.
  }
}

import { checkoutAt } from "@compforge/repokit";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
export const STATE_DIRECTORY_NAME = ".devloop";
export const WORKSPACE_STATE_FILE = "context.json";
function sharedStateRoot(root) {
    const info = checkoutAt(root);
    return info ? info.mainRoot ?? info.commonDir : root;
}
export function stateDirectory(root) { return join(sharedStateRoot(resolve(root)), STATE_DIRECTORY_NAME); }
export function workingTreeStateDirectory(root) { return join(resolve(root), STATE_DIRECTORY_NAME); }
export function commitMessageFile(root) { return join(workingTreeStateDirectory(root), "commit_msg"); }
export function temporaryDirectory(root) { return join(stateDirectory(root), "tmp"); }
export function branchSegment(branch, name) { return `branches/${branch ?? "@detached"}/${name}`; }
export function workspaceStateFile(root) { return join(stateDirectory(root), WORKSPACE_STATE_FILE); }
export function segmentFile(root, name) { return join(stateDirectory(root), `${name}.json`); }
function atomicWrite(path, data) {
    try {
        mkdirSync(dirname(path), { recursive: true });
        const temporary = join(dirname(path), `${parse(path).base}.${process.pid}.tmp`);
        writeFileSync(temporary, JSON.stringify(data, null, 2), "utf8");
        renameSync(temporary, path);
    }
    catch {
        // Context is a derived cache; the next refresh can reconstruct it.
    }
}
function readJson(path) {
    if (!existsSync(path))
        return undefined;
    try {
        const value = JSON.parse(readFileSync(path, "utf8"));
        return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
    }
    catch {
        return undefined;
    }
}
export function loadWorkspace(root) { return readJson(workspaceStateFile(root)); }
export function saveWorkspace(root, data) { atomicWrite(workspaceStateFile(root), data); }
export function loadSegment(root, name) { return readJson(segmentFile(root, name)); }
export function saveSegment(root, name, data) { atomicWrite(segmentFile(root, name), data); }
export function appendLedger(root, name, record) {
    try {
        const path = join(stateDirectory(root), `${name}.jsonl`);
        mkdirSync(dirname(path), { recursive: true });
        appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
    }
    catch {
        // Ledgers are observability and never gate the harness action.
    }
}
//# sourceMappingURL=store.js.map
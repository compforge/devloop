import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expandPath, setWorkspaces, workspaces } from "../lib/config.js";
import { parseSubprojectsSection } from "../lib/parsers.js";
import { discoverSubprojectNames } from "./context/workspace.js";

function reserved(path: string): boolean {
  const root = resolve(path);
  return [
    process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    process.env.CLAUDE_HOME ?? join(homedir(), ".claude"),
  ].some((candidate) => resolve(expandPath(candidate)) === root);
}

export function registeredWorkspaces(): readonly string[] {
  return workspaces().map((path) => resolve(path)).filter((path) => !reserved(path));
}

export function registerWorkspace(path: string): void {
  const root = resolve(expandPath(path));
  if (reserved(root)) return;
  const current = [...registeredWorkspaces()];
  if (!current.includes(root)) setWorkspaces([...current, root]);
}

export function maybeRegisterWorkspace(path: string): string | undefined {
  const root = resolve(path);
  if (reserved(root) || !existsSync(root) || !statSync(root).isDirectory() || existsSync(join(root, ".git"))) return undefined;
  const agents = join(root, "AGENTS.md");
  if (!existsSync(agents)) return undefined;
  if (discoverSubprojectNames(root).length === 0 && parseSubprojectsSection(agents).length === 0) return undefined;
  registerWorkspace(root);
  return root;
}

export function findContainingWorkspace(path: string): string | undefined {
  const target = resolve(path);
  return registeredWorkspaces().find((root) => target === root || target.startsWith(`${root}/`));
}

export function isWorkspaceRoot(path: string): boolean {
  const target = resolve(path);
  return registeredWorkspaces().some((root) => root === target);
}

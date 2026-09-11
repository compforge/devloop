import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { ensureGitExclude } from "../../lib/git-state.js";
import { parseReferencesSection, parseSubprojectsSection, type SubprojectEntry } from "../../lib/parsers.js";
import { now, referenceFrom, stale, WORKSPACE_STALE_SECONDS, type AgentsDocument } from "./base.js";
import { loadWorkspace, saveWorkspace } from "./store.js";

export interface Subproject {
  readonly name: string;
  readonly path: string;
  readonly aliases: readonly string[];
  readonly language?: string;
  readonly role?: string;
  readonly canonical?: string;
}

export interface WorkspaceContextRecord {
  readonly workspace_root: string;
  readonly agents_md: { readonly path?: string; readonly references?: readonly { readonly title?: string; readonly path?: string; readonly hook?: string }[] };
  readonly subprojects: readonly {
    readonly name?: string; readonly path?: string; readonly aliases?: readonly string[];
    readonly language?: string; readonly role?: string; readonly canonical?: string;
  }[];
  readonly parsed_at: number;
}

const DISCOVERY_SKIP = new Set(["docs", "worktrees", "worktree", "node_modules"]);

function isGitRepository(path: string): boolean {
  return existsSync(join(path, ".git"));
}

export function discoverSubprojectNames(root: string): readonly string[] {
  try {
    return readdirSync(root).filter((name) => {
      if (name.startsWith(".") || DISCOVERY_SKIP.has(name)) return false;
      const path = join(root, name);
      try { return (lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()) && isGitRepository(path); }
      catch { return false; }
    }).sort();
  } catch { return []; }
}

function mergeSubprojects(root: string, declared: readonly SubprojectEntry[]): readonly Subproject[] {
  const byName = new Map(declared.map((entry) => [entry.name, entry]));
  return discoverSubprojectNames(root).map((name) => {
    const entry = byName.get(name);
    const path = join(root, name);
    let canonical: string | undefined;
    try {
      const real = realpathSync(path);
      if (real !== resolve(path)) canonical = real;
    } catch { /* optional projection */ }
    return {
      name,
      path,
      aliases: entry?.aliases ?? [],
      ...(entry?.language ? { language: entry.language } : {}),
      ...(entry?.role ? { role: entry.role } : {}),
      ...(canonical ? { canonical } : {}),
    };
  });
}

/** Aggregate-workspace facts parsed from AGENTS.md and the filesystem. */
export class WorkspaceContext {
  constructor(
    readonly workspaceRoot: string,
    readonly agentsDocument: AgentsDocument,
    readonly subprojects: readonly Subproject[],
    readonly parsedAt: number,
  ) {}

  static load(root: string): WorkspaceContext | undefined {
    const record = loadWorkspace(root) as WorkspaceContextRecord | undefined;
    if (!record) return undefined;
    const references = (record.agents_md?.references ?? []).map((reference) => ({
      title: reference.title ?? "", path: reference.path ?? "", ...(reference.hook ? { hook: reference.hook } : {}),
    }));
    return new WorkspaceContext(
      record.workspace_root || resolve(root),
      { ...(record.agents_md?.path ? { path: record.agents_md.path } : {}), references },
      record.subprojects.map((entry) => ({
        name: entry.name ?? "", path: entry.path ?? "", aliases: entry.aliases ?? [],
        ...(entry.language ? { language: entry.language } : {}), ...(entry.role ? { role: entry.role } : {}),
        ...(entry.canonical ? { canonical: entry.canonical } : {}),
      })),
      record.parsed_at || 0,
    );
  }

  static refresh(rootValue: string): WorkspaceContext {
    const root = resolve(rootValue);
    const agentsPath = join(root, "AGENTS.md");
    const hasAgents = existsSync(agentsPath);
    const context = new WorkspaceContext(
      root,
      { ...(hasAgents ? { path: agentsPath } : {}), references: hasAgents ? parseReferencesSection(agentsPath).map(referenceFrom) : [] },
      mergeSubprojects(root, hasAgents ? parseSubprojectsSection(agentsPath) : []),
      now(),
    );
    context.save();
    return context;
  }

  save(): void {
    saveWorkspace(this.workspaceRoot, {
      workspace_root: this.workspaceRoot,
      agents_md: {
        ...(this.agentsDocument.path ? { path: this.agentsDocument.path } : {}),
        references: this.agentsDocument.references.map((reference) => ({
          title: reference.title, path: reference.path, ...(reference.hook ? { hook: reference.hook } : {}),
        })),
      },
      subprojects: this.subprojects.map((item) => ({
        name: item.name, path: item.path, aliases: [...item.aliases],
        ...(item.language ? { language: item.language } : {}), ...(item.role ? { role: item.role } : {}),
        ...(item.canonical ? { canonical: item.canonical } : {}),
      })),
      parsed_at: this.parsedAt,
    });
    if (existsSync(join(this.workspaceRoot, ".git"))) ensureGitExclude(this.workspaceRoot);
  }

  isStale(ttl = WORKSPACE_STALE_SECONDS): boolean { return stale(this.parsedAt || undefined, ttl); }
}

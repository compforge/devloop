import { InspectionError } from "../lib/repocli.js";
import { snapshot, changedPaths as toolkitChangedPaths } from "@compforge/repocli";
import { realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { runGit } from "../lib/process.js";
import { Component, ComponentCatalog, enclosingComponent } from "./repo-layout.js";

export interface WorkSet { readonly components: readonly Component[]; readonly reason: string }

function paths(result: ReturnType<typeof runGit>): readonly string[] | undefined {
  return result.ok ? result.stdout.split("\n").map((path) => path.trim()).filter(Boolean) : undefined;
}

function workingPaths(root: string): readonly string[] | undefined {
  try { return toolkitChangedPaths(root); } catch { return undefined; }
}

export function changedPaths(root: string): readonly string[] { return workingPaths(root) ?? []; }
export function changedPathsInScope(root: string, scopes: readonly string[]): readonly string[] | undefined {
  const changed = workingPaths(root);
  if (!changed) return undefined;
  const selected: string[] = [];
  for (const raw of scopes) {
    const scope = raw.trim().replace(/\/$/, "") || ".";
    const matches = changed.filter((path) => scope === "." || path === scope || path.startsWith(`${scope}/`));
    for (const path of matches.length > 0 ? matches : [scope]) if (!selected.includes(path)) selected.push(path);
  }
  return selected;
}
export function committedPaths(root: string, revision = "HEAD"): readonly string[] | undefined {
  return paths(runGit(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", revision]));
}
export function rangePaths(root: string, base: string, head = "HEAD"): readonly string[] | undefined {
  return paths(runGit(root, ["diff", "--name-only", `${base}...${head}`]));
}

function projectComponents(changed: readonly string[], catalog: ComponentCatalog): readonly Component[] {
  const byId = new Map<string, Component>();
  for (const path of changed) {
    const owner = catalog.owner(join(catalog.root, path));
    if (owner) byId.set(owner.id, owner);
  }
  return [...byId.values()];
}

export function selectComponents(rootValue: string, options: { readonly explicit?: string; readonly paths?: readonly string[]; readonly catalog: ComponentCatalog }): WorkSet {
  const root = realpathSync(rootValue);
  const catalog = options.catalog;
  if (catalog.components.length === 0) throw new InspectionError("repocli inspect returned no Components for validation");
  if (options.explicit) {
    const explicit = resolve(options.explicit);
    if (explicit !== root && explicit.startsWith(`${root}/`)) {
      const component = enclosingComponent(explicit, catalog);
      return { components: [component], reason: `explicit target ${basename(explicit)} -> component ${basename(component.path)}` };
    }
  }
  if (options.paths !== undefined) {
    const components = projectComponents(options.paths, catalog);
    return components.length === 0
      ? { components: [], reason: "no changed files in scope" }
      : { components, reason: `changed files under: ${components.map((item) => basename(item.path)).join(", ")}` };
  }
  const dirty = projectComponents(changedPaths(root), catalog);
  if (dirty.length > 0) return { components: dirty, reason: `changed files under: ${dirty.map((item) => basename(item.path)).join(", ")}` };
  const all = catalog.components;
  return { components: all, reason: `clean tree, all components: ${all.map((item) => basename(item.path)).join(", ")}` };
}

export async function componentFingerprint(root: string, _component: Component, _catalog: ComponentCatalog): Promise<string | undefined> {
  try { const observed = await snapshot(root); return observed.complete ? observed.digest : undefined; }
  catch { return undefined; }
}

export function fuzzyScore(query: string, name: string): number | undefined {
  const q = query.toLowerCase(); const n = name.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 10 + n.length - q.length;
  const at = n.indexOf(q); if (at >= 0) return 100 + at + n.length - q.length;
  let index = 0; for (const char of n) if (char === q[index]) index += 1;
  return index === q.length ? 1_000 + n.length - q.length : undefined;
}

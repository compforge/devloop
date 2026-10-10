import { snapshot, changedPaths as toolkitChangedPaths, committedPaths as toolkitCommittedPaths, rangePaths as toolkitRangePaths } from "@compforge/repocli";
import { realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Component, ComponentCatalog, enclosingComponent } from "./repo-layout.js";
function workingPaths(root) {
    try {
        return toolkitChangedPaths(root);
    }
    catch {
        return undefined;
    }
}
export function changedPaths(root) { return workingPaths(root) ?? []; }
export function changedPathsInScope(root, scopes) {
    const changed = workingPaths(root);
    if (!changed)
        return undefined;
    const selected = [];
    for (const raw of scopes) {
        const scope = raw.trim().replace(/\/$/, "") || ".";
        const matches = changed.filter((path) => scope === "." || path === scope || path.startsWith(`${scope}/`));
        for (const path of matches.length > 0 ? matches : [scope])
            if (!selected.includes(path))
                selected.push(path);
    }
    return selected;
}
export function committedPaths(root, revision = "HEAD") {
    try {
        return toolkitCommittedPaths(root, revision);
    }
    catch {
        return undefined;
    }
}
export function rangePaths(root, base, head = "HEAD") {
    try {
        return toolkitRangePaths(root, base, head);
    }
    catch {
        return undefined;
    }
}
function projectComponents(changed, catalog) {
    const byId = new Map();
    for (const path of changed) {
        const owner = catalog.owner(join(catalog.root, path));
        if (owner)
            byId.set(owner.id, owner);
    }
    return [...byId.values()];
}
export function selectComponents(rootValue, options) {
    const root = realpathSync(rootValue);
    const catalog = options.catalog;
    if (catalog.components.length === 0)
        return { components: [], reason: "no recognized Components; validation not run" };
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
    if (dirty.length > 0)
        return { components: dirty, reason: `changed files under: ${dirty.map((item) => basename(item.path)).join(", ")}` };
    const all = catalog.components;
    return { components: all, reason: `clean tree, all components: ${all.map((item) => basename(item.path)).join(", ")}` };
}
export async function componentFingerprint(root, _component, _catalog) {
    try {
        const observed = await snapshot(root);
        return observed.complete ? observed.digest : undefined;
    }
    catch {
        return undefined;
    }
}
export function fuzzyScore(query, name) {
    const q = query.toLowerCase();
    const n = name.toLowerCase();
    if (n === q)
        return 0;
    if (n.startsWith(q))
        return 10 + n.length - q.length;
    const at = n.indexOf(q);
    if (at >= 0)
        return 100 + at + n.length - q.length;
    let index = 0;
    for (const char of n)
        if (char === q[index])
            index += 1;
    return index === q.length ? 1_000 + n.length - q.length : undefined;
}
//# sourceMappingURL=repo.js.map
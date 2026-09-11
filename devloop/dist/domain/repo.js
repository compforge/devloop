import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { runGit } from "../lib/process.js";
import { Component, discoverComponents, enclosingComponent, owningComponent } from "./repo-layout.js";
function paths(result) {
    return result.ok ? result.stdout.split("\n").map((path) => path.trim()).filter(Boolean) : undefined;
}
function workingPaths(root) {
    const tracked = paths(runGit(root, ["diff", "--name-only", "HEAD"]));
    const untracked = paths(runGit(root, ["ls-files", "--others", "--exclude-standard"]));
    if (!tracked || !untracked)
        return undefined;
    return [...tracked, ...untracked.filter((path) => {
            const target = join(root, path);
            try {
                return !lstatSync(target).isSymbolicLink() && !(lstatSync(target).isDirectory() && existsSync(join(target, ".git")));
            }
            catch {
                return true;
            }
        })];
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
    return paths(runGit(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", revision]));
}
export function rangePaths(root, base, head = "HEAD") {
    return paths(runGit(root, ["diff", "--name-only", `${base}...${head}`]));
}
function projectComponents(root, changed) {
    const byId = new Map();
    for (const path of changed) {
        const owner = owningComponent(join(root, path), root);
        if (owner)
            byId.set(owner.id, owner);
    }
    return [...byId.values()];
}
export function selectComponents(rootValue, options = {}) {
    const root = resolve(rootValue);
    if (options.explicit) {
        const explicit = resolve(options.explicit);
        if (explicit !== root && explicit.startsWith(`${root}/`)) {
            const component = enclosingComponent(explicit, root);
            return { components: [component], reason: `explicit target ${basename(explicit)} -> component ${basename(component.path)}` };
        }
    }
    if (options.paths !== undefined) {
        const components = projectComponents(root, options.paths);
        return components.length === 0
            ? { components: [], reason: "no changed files in scope" }
            : { components, reason: `changed files under: ${components.map((item) => basename(item.path)).join(", ")}` };
    }
    const dirty = projectComponents(root, changedPaths(root));
    if (dirty.length > 0)
        return { components: dirty, reason: `changed files under: ${dirty.map((item) => basename(item.path)).join(", ")}` };
    const all = discoverComponents(root);
    return { components: all, reason: `clean tree, all components: ${all.map((item) => basename(item.path)).join(", ")}` };
}
export function componentFingerprint(root, component) {
    const changed = workingPaths(root);
    if (!changed)
        return undefined;
    const hash = createHash("sha256").update(component.id);
    try {
        for (const path of [...changed].sort()) {
            const owner = owningComponent(join(root, path), root);
            if (owner?.id !== component.id)
                continue;
            const target = join(root, path);
            hash.update("\0path\0").update(path);
            if (!existsSync(target))
                hash.update("\0deleted\0");
            else if (lstatSync(target).isSymbolicLink())
                hash.update("\0symlink\0").update(readlinkSync(target));
            else if (lstatSync(target).isFile())
                hash.update("\0file\0").update(readFileSync(target));
            else
                hash.update("\0other\0");
        }
        return hash.digest("hex");
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
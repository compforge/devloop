import { existsSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { inspectRepository, InspectionError } from "../lib/repokit.js";
import { findCheckout, owner } from "@compforge/repokit";
/** Repository directory used as the granularity for engineering operations. */
export class Component {
    name;
    tools;
    depot;
    toolEvidence;
    path;
    id;
    language;
    constructor(path, id, language, name = "", tools = [], depot, toolEvidence = {}) {
        this.name = name;
        this.tools = tools;
        this.depot = depot;
        this.toolEvidence = toolEvidence;
        this.path = path;
        this.id = id;
        this.language = language;
    }
    static at(pathValue, gitRoot) {
        const path = realpathSync(pathValue);
        const root = realpathSync(gitRoot);
        const id = relative(root, path).replaceAll("\\", "/") || ".";
        return new Component(pathValue, id.startsWith("../") ? path.replaceAll("\\", "/") : id, undefined);
    }
    static fromInfo(root, info) {
        return new Component(join(root, info.root), info.root, info.language, info.name, info.tools ?? [], info.depot, info.toolEvidence ?? {});
    }
}
export function findGitRoot(path) {
    return findCheckout(path);
}
export function isGitRepository(path) { return findGitRoot(path) !== undefined; }
/** One operation's catalog; file ownership is a projection of discovered roots. */
export class ComponentCatalog {
    root;
    report;
    components;
    constructor(root, report) {
        this.root = root;
        this.report = report;
        this.components = report.components.map((info) => Component.fromInfo(root, info));
    }
    owner(target) {
        const path = relative(this.root, resolve(target)).replaceAll("\\", "/");
        if (path === ".." || path.startsWith("../"))
            return undefined;
        const binding = owner(this.report, path || ".");
        return binding ? this.components.find((component) => component.id === binding.root) : undefined;
    }
    default() {
        for (const preferred of ["server", "backend", "."]) {
            const component = this.components.find((c) => c.id === preferred);
            if (component)
                return component;
        }
        if (this.components.length === 1)
            return this.components[0];
        throw new InspectionError("no default Component; select a discovered component explicitly");
    }
}
export async function inspectCatalog(root) {
    const checkout = realpathSync(root);
    return new ComponentCatalog(checkout, await inspectRepository(checkout));
}
export async function defaultComponent(root) { return (await inspectCatalog(root)).default(); }
export async function findRepoCodeDirectory(root) { return (await defaultComponent(root)).path; }
export function owningComponent(target, catalog) { return catalog.owner(target); }
export function enclosingComponent(target, catalog) { return catalog.owner(target) ?? catalog.default(); }
export async function discoverComponents(root) { return (await inspectCatalog(root)).components; }
export function findAgentsDocument(repo, component) {
    return [component ? join(component, "AGENTS.md") : "", join(repo, "AGENTS.md")].find((path) => path && existsSync(path));
}
export async function resolveRepo(path) {
    const root = findGitRoot(resolve(path));
    return root ? { name: basename(root), root, components: await discoverComponents(root) } : undefined;
}
export function containsPath(repo, path) { const value = resolve(path); return value === resolve(repo.root) || value.startsWith(`${resolve(repo.root)}/`); }
//# sourceMappingURL=repo-layout.js.map
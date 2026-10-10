import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { inspectRepository, InspectionError } from "../lib/repocli.js";
import { findCheckout, owner } from "@compforge/repocli";
const SAFE_SCOPE = /^[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*$/;
/** Repository directory used as the granularity for engineering operations. */
export class Component {
    name;
    packageTools;
    path;
    id;
    language;
    constructor(path, id, language, name = "", packageTools = []) {
        this.name = name;
        this.packageTools = packageTools;
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
        return new Component(join(root, info.root), info.root, info.language, info.name, info.packageTools ?? []);
    }
    hasTarget(name, suffix = false) {
        try {
            const makefile = readFileSync(join(this.path, "Makefile"), "utf8");
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(`^${escaped}${suffix ? "(-\\w+)?" : ""}$`);
            // Read literal rule headers without evaluating make expansions or recipes.
            return makefile.replaceAll("\\\n", " ").split("\n").some(line => {
                if (line.startsWith("\t"))
                    return false;
                const rule = line.split("#", 1)[0];
                const colon = rule.indexOf(":");
                if (colon < 0 || rule.slice(0, colon).includes("=") || rule[colon + 1] === "=")
                    return false;
                return rule.slice(0, colon).trim().split(/\s+/).some(target => pattern.test(target));
            });
        }
        catch {
            return false;
        }
    }
    lintTarget() { return ["lint-ci", "lint"].find((target) => this.hasTarget(target)); }
    testTarget() { return ["test", "test-ci", "test-local"].find((target) => this.hasTarget(target)); }
    testCommand() {
        const target = this.testTarget();
        return target ? ["make", target] : undefined;
    }
    supportsLintFiles() { return this.makefileUses("LINT_FILES"); }
    supportsTestFiles() { return this.makefileUses("TEST_FILES"); }
    makefileUses(variable) {
        try {
            return new RegExp(`\\$\\(${variable}\\)|\\$\\{${variable}\\}`).test(readFileSync(join(this.path, "Makefile"), "utf8"));
        }
        catch {
            return false;
        }
    }
    focusedLintCommand(files, target = this.lintTarget()) {
        return target && files.length > 0 && this.supportsLintFiles() && files.every((path) => SAFE_SCOPE.test(path))
            ? ["make", target, `LINT_FILES=${files.join(" ")}`] : undefined;
    }
    focusedTestCommand(files) {
        const target = this.testTarget();
        return target && files.length > 0 && this.supportsTestFiles() && files.every((path) => SAFE_SCOPE.test(path))
            ? ["make", target, `TEST_FILES=${files.join(" ")}`] : undefined;
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
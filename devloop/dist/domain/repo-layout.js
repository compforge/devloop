import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { detectEcosystem } from "../lib/ecosystem.js";
import { inspectRepository, InspectionError } from "../lib/repocli.js";
import { runGit } from "../lib/process.js";
const SAFE_SCOPE = /^[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*$/;
/** Independently buildable and validatable directory within a repository. */
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
        return new Component(join(root, info.root), info.root, info.language, info.name, info.packageTools);
    }
    hasTarget(name, suffix = false) {
        try {
            const makefile = readFileSync(join(this.path, "Makefile"), "utf8");
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`^${escaped}${suffix ? "(-\\w+)?" : ""}\\s*:`, "m").test(makefile);
        }
        catch {
            return false;
        }
    }
    lintTarget() { return ["lint-ci", "lint"].find((target) => this.hasTarget(target)); }
    testTarget() { return ["test", "test-ci", "test-local"].find((target) => this.hasTarget(target)); }
    testCommand() {
        const target = this.testTarget();
        return target ? ["make", target] : detectEcosystem(this.path)?.fallbackTestCommand(this.path);
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
    const result = runGit(path, ["rev-parse", "--show-toplevel"], 3_000);
    return result.ok && result.stdout ? result.stdout : undefined;
}
export function isGitRepository(path) { return findGitRoot(path) !== undefined; }
/** One operation's catalog; file ownership is a projection of declared roots. */
export class ComponentCatalog {
    root;
    components;
    constructor(root) {
        this.root = root;
        this.components = inspectRepository(root).map((info) => Component.fromInfo(root, info));
    }
    owner(target) {
        const path = resolve(target);
        return this.components.filter((c) => path === c.path || path.startsWith(c.path + "/")).sort((a, b) => b.path.length - a.path.length)[0];
    }
    default() {
        for (const preferred of ["server", "backend", "."]) {
            const component = this.components.find((c) => c.id === preferred);
            if (component)
                return component;
        }
        if (this.components.length === 1)
            return this.components[0];
        throw new InspectionError("no default Component; select a declared component explicitly");
    }
}
export function inspectCatalog(root) { return new ComponentCatalog(realpathSync(root)); }
export function defaultComponent(root) { return inspectCatalog(root).default(); }
export function findRepoCodeDirectory(root) { return defaultComponent(root).path; }
export function owningComponent(target, root, catalog = inspectCatalog(root)) { return catalog.owner(target); }
export function enclosingComponent(target, root, catalog = inspectCatalog(root)) { return catalog.owner(target) ?? catalog.default(); }
export function discoverComponents(root) { return inspectCatalog(root).components; }
export function findAgentsDocument(repo, component) {
    return [component ? join(component, "AGENTS.md") : "", join(repo, "AGENTS.md")].find((path) => path && existsSync(path));
}
export function resolveRepo(path) {
    const root = findGitRoot(resolve(path));
    return root ? { name: basename(root), root, components: discoverComponents(root) } : undefined;
}
export function containsPath(repo, path) { const value = resolve(path); return value === resolve(repo.root) || value.startsWith(`${resolve(repo.root)}/`); }
//# sourceMappingURL=repo-layout.js.map
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { detectEcosystem, detectLanguage } from "../lib/ecosystem.js";
import { runGit } from "../lib/process.js";
const SAFE_SCOPE = /^[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*$/;
const DISCOVERY_SKIP = new Set([".git", "node_modules", ".venv", "venv", "env", ".tox", "dist", "build", "target", "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".idea", ".vscode", "vendor"]);
/** Independently buildable and validatable directory within a repository. */
export class Component {
    path;
    id;
    language;
    constructor(path, id, language) {
        this.path = path;
        this.id = id;
        this.language = language;
    }
    static at(pathValue, gitRoot) {
        const path = realpathSync(pathValue);
        const root = realpathSync(gitRoot);
        const id = relative(root, path).replaceAll("\\", "/") || ".";
        return new Component(pathValue, id.startsWith("../") ? path.replaceAll("\\", "/") : id, detectLanguage(pathValue));
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
function isComponent(path) { return detectEcosystem(path) !== undefined; }
export function defaultComponent(rootValue) {
    const root = resolve(rootValue);
    for (const name of ["server", "backend"]) {
        const candidate = join(root, name);
        if (existsSync(candidate) && isComponent(candidate))
            return Component.at(candidate, root);
    }
    return Component.at(root, root);
}
export function findRepoCodeDirectory(rootValue) {
    return defaultComponent(rootValue).path;
}
export function owningComponent(targetValue, rootValue) {
    const root = realpathSync(rootValue);
    const target = resolve(targetValue);
    let current;
    try {
        current = lstatSync(target).isDirectory() ? realpathSync(target) : dirname(realpathSync(target));
    }
    catch {
        current = dirname(target);
    }
    let nested = current;
    while (nested !== root && nested.startsWith(`${root}/`)) {
        if (existsSync(join(nested, ".git"))) {
            current = dirname(nested);
            break;
        }
        nested = dirname(nested);
    }
    while (current !== root && current.startsWith(`${root}/`)) {
        if (isComponent(current))
            return Component.at(current, rootValue);
        current = dirname(current);
    }
    return isComponent(root) ? Component.at(rootValue, rootValue) : undefined;
}
export function enclosingComponent(target, root) { return owningComponent(target, root) ?? defaultComponent(root); }
export function discoverComponents(rootValue, maxDepth = 4) {
    const root = realpathSync(rootValue);
    const components = [];
    const walk = (directory, depth) => {
        if (depth > maxDepth)
            return;
        let names;
        try {
            names = readdirSync(directory).sort();
        }
        catch {
            return;
        }
        for (const name of names) {
            const path = join(directory, name);
            let stat;
            try {
                stat = lstatSync(path);
            }
            catch {
                continue;
            }
            if (name.startsWith(".") || DISCOVERY_SKIP.has(name) || stat.isSymbolicLink() || !stat.isDirectory() || existsSync(join(path, ".git")))
                continue;
            if (isComponent(path))
                components.push(Component.at(path, rootValue));
            else
                walk(path, depth + 1);
        }
    };
    if (isComponent(root))
        components.push(Component.at(rootValue, rootValue));
    walk(root, 1);
    return components.length > 0 ? components : [defaultComponent(rootValue)];
}
export function findAgentsDocument(repo, component) {
    return [component ? join(component, "AGENTS.md") : "", join(repo, "AGENTS.md")].find((path) => path && existsSync(path));
}
export function resolveRepo(path) {
    const root = findGitRoot(resolve(path));
    return root ? { name: basename(root), root, components: discoverComponents(root) } : undefined;
}
export function containsPath(repo, path) { const value = resolve(path); return value === resolve(repo.root) || value.startsWith(`${resolve(repo.root)}/`); }
//# sourceMappingURL=repo-layout.js.map
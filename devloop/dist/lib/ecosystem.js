import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runCommand } from "./process.js";
class BaseEcosystem {
    language(_path) { return this.name; }
    matchesLanguage(path) { return this.manifests.some((manifest) => existsSync(join(path, manifest))); }
    prepareCommand(_path) { return undefined; }
    environmentProblem(_path) { return undefined; }
    markPrepared(_path) { }
    fallbackTestCommand(_path) { return undefined; }
    isTestFile(_path) { return false; }
}
class GoEcosystem extends BaseEcosystem {
    name = "go";
    manifests = ["go.mod"];
    fallbackTestCommand() { return ["go", "test", "./..."]; }
    isTestFile(path) { return basename(path).endsWith("_test.go"); }
}
function hashFiles(path, names) {
    const hash = createHash("sha256");
    for (const name of names) {
        hash.update(name);
        hash.update("\0");
        try {
            hash.update(readFileSync(join(path, name)));
        }
        catch { /* missing input remains represented by its name */ }
        hash.update("\0");
    }
    return hash.digest("hex");
}
const NODE_LOCKFILES = [
    ["pnpm-lock.yaml", ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"]],
    ["package-lock.json", ["npm", "ci", "--prefer-offline"]],
    ["yarn.lock", ["yarn", "install", "--immutable"]],
];
class NodeEcosystem extends BaseEcosystem {
    name = "node";
    manifests = ["package.json"];
    language(path) {
        try {
            const content = readFileSync(join(path, "package.json"), "utf8").toLowerCase();
            return content.includes("typescript") || content.includes("@types/") ? "typescript" : "javascript";
        }
        catch {
            return "javascript";
        }
    }
    lockfile(path) {
        return NODE_LOCKFILES.find(([name]) => existsSync(join(path, name)));
    }
    prepareCommand(path) { return this.lockfile(path)?.[1]; }
    environmentProblem(path) {
        const lockfile = this.lockfile(path);
        const modules = join(path, "node_modules");
        if (!existsSync(modules)) {
            return lockfile
                ? "node_modules missing - in-repo worktrees can resolve dependencies from another checkout"
                : "node_modules missing and no supported lockfile exists - cannot prepare without changing project state";
        }
        if (!lockfile)
            return undefined;
        const marker = join(modules, ".devloop-envhash");
        if (!existsSync(marker))
            return undefined;
        try {
            return readFileSync(marker, "utf8").trim() === hashFiles(path, ["package.json", lockfile[0]])
                ? undefined : "package.json or lockfile changed since devloop installed dependencies";
        }
        catch (error) {
            return `cannot read devloop environment fingerprint: ${String(error)}`;
        }
    }
    markPrepared(path) {
        const lockfile = this.lockfile(path);
        const modules = join(path, "node_modules");
        if (lockfile && existsSync(modules))
            writeFileSync(join(modules, ".devloop-envhash"), hashFiles(path, ["package.json", lockfile[0]]));
    }
    isTestFile(path) { return /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(basename(path)); }
}
class PythonEcosystem extends BaseEcosystem {
    name = "python";
    manifests = ["pyproject.toml", "setup.py"];
    matchesLanguage(path) { return super.matchesLanguage(path) || existsSync(join(path, "requirements.txt")); }
    isUvManaged(path) { return existsSync(join(path, "pyproject.toml")) && existsSync(join(path, "uv.lock")); }
    prepareCommand(path) { return this.isUvManaged(path) ? ["uv", "sync", "--frozen"] : undefined; }
    environmentProblem(path) {
        if (!this.isUvManaged(path))
            return undefined;
        const environment = join(path, ".venv");
        if (!existsSync(environment))
            return ".venv missing - a stale VIRTUAL_ENV could run another checkout's editable install";
        const marker = join(environment, ".devloop-envhash");
        if (!existsSync(marker))
            return undefined;
        try {
            return readFileSync(marker, "utf8").trim() === hashFiles(path, ["pyproject.toml", "uv.lock"])
                ? undefined : "pyproject.toml or uv.lock changed since devloop synced dependencies";
        }
        catch (error) {
            return `cannot read devloop environment fingerprint: ${String(error)}`;
        }
    }
    markPrepared(path) {
        const environment = join(path, ".venv");
        if (this.isUvManaged(path) && existsSync(environment))
            writeFileSync(join(environment, ".devloop-envhash"), hashFiles(path, ["pyproject.toml", "uv.lock"]));
    }
    isTestFile(path) {
        const name = basename(path);
        return name.endsWith(".py") && (name.startsWith("test_") || name.endsWith("_test.py"));
    }
}
export const ECOSYSTEMS = [new PythonEcosystem(), new GoEcosystem(), new NodeEcosystem()];
export function detectEcosystem(path) {
    return ECOSYSTEMS.find((ecosystem) => ecosystem.manifests.some((manifest) => existsSync(join(path, manifest))));
}
export function detectLanguage(path) {
    return ECOSYSTEMS.find((ecosystem) => ecosystem.matchesLanguage(path))?.language(path);
}
/** Prepare a component with the ecosystem's frozen install command. */
export function ensureEnvironmentReady(path) {
    const ecosystem = detectEcosystem(path);
    if (!ecosystem)
        return undefined;
    const problem = ecosystem.environmentProblem(path);
    if (!problem)
        return undefined;
    const command = ecosystem.prepareCommand(path);
    if (!command?.[0])
        return problem;
    const result = runCommand(command[0], command.slice(1), { cwd: path, timeoutMs: 600_000 });
    if (!result.ok) {
        const tail = `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-15).join("\n");
        return `${problem}; auto-prepare \`${command.join(" ")}\` failed (${result.code}):\n${tail}`;
    }
    try {
        ecosystem.markPrepared(path);
    }
    catch (error) {
        return `environment prepared but fingerprint could not be written: ${String(error)}`;
    }
    const remaining = ecosystem.environmentProblem(path);
    return remaining ? `environment prepared but is still not ready: ${remaining}` : undefined;
}
//# sourceMappingURL=ecosystem.js.map
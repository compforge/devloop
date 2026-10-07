import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCommand } from "./process.js";
class BaseEcosystem {
    prepareCommand(_path) { return undefined; }
    environmentProblem(_path) { return undefined; }
    markPrepared(_path) { }
    fallbackTestCommand(_path) { return undefined; }
}
class GoEcosystem extends BaseEcosystem {
    name = "go";
    fallbackTestCommand() { return ["go", "test", "./..."]; }
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
}
class PythonEcosystem extends BaseEcosystem {
    name = "python";
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
}
export const ECOSYSTEMS = [new PythonEcosystem(), new GoEcosystem(), new NodeEcosystem()];
export function detectEcosystem(language) {
    const name = ["javascript", "typescript", "tsx", "jsx"].includes(language ?? "") ? "node" : language;
    return ECOSYSTEMS.find(ecosystem => ecosystem.name === name);
}
/** Prepare a component with the ecosystem's frozen install command. */
export function ensureEnvironmentReady(path, language) {
    const ecosystem = detectEcosystem(language);
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
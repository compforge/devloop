import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runCommand } from "./process.js";

export type EcosystemName = "python" | "go" | "node";

export interface Ecosystem {
  readonly name: EcosystemName;
  readonly manifests: readonly string[];
  language(path: string): string;
  matchesLanguage(path: string): boolean;
  prepareCommand(path: string): readonly string[] | undefined;
  environmentProblem(path: string): string | undefined;
  markPrepared(path: string): void;
  fallbackTestCommand(path: string): readonly string[] | undefined;
  isTestFile(path: string): boolean;
}

abstract class BaseEcosystem implements Ecosystem {
  abstract readonly name: EcosystemName;
  abstract readonly manifests: readonly string[];
  language(_path: string): string { return this.name; }
  matchesLanguage(path: string): boolean { return this.manifests.some((manifest) => existsSync(join(path, manifest))); }
  prepareCommand(_path: string): readonly string[] | undefined { return undefined; }
  environmentProblem(_path: string): string | undefined { return undefined; }
  markPrepared(_path: string): void {}
  fallbackTestCommand(_path: string): readonly string[] | undefined { return undefined; }
  isTestFile(_path: string): boolean { return false; }
}

class GoEcosystem extends BaseEcosystem {
  readonly name = "go";
  readonly manifests = ["go.mod"];
  override fallbackTestCommand(): readonly string[] { return ["go", "test", "./..."]; }
  override isTestFile(path: string): boolean { return basename(path).endsWith("_test.go"); }
}

function hashFiles(path: string, names: readonly string[]): string {
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(name); hash.update("\0");
    try { hash.update(readFileSync(join(path, name))); } catch { /* missing input remains represented by its name */ }
    hash.update("\0");
  }
  return hash.digest("hex");
}

const NODE_LOCKFILES: readonly [name: string, command: readonly string[]][] = [
  ["pnpm-lock.yaml", ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"]],
  ["package-lock.json", ["npm", "ci", "--prefer-offline"]],
  ["yarn.lock", ["yarn", "install", "--immutable"]],
];

class NodeEcosystem extends BaseEcosystem {
  readonly name = "node";
  readonly manifests = ["package.json"];
  override language(path: string): string {
    try {
      const content = readFileSync(join(path, "package.json"), "utf8").toLowerCase();
      return content.includes("typescript") || content.includes("@types/") ? "typescript" : "javascript";
    } catch { return "javascript"; }
  }
  private lockfile(path: string): readonly [string, readonly string[]] | undefined {
    return NODE_LOCKFILES.find(([name]) => existsSync(join(path, name)));
  }
  override prepareCommand(path: string): readonly string[] | undefined { return this.lockfile(path)?.[1]; }
  override environmentProblem(path: string): string | undefined {
    const lockfile = this.lockfile(path);
    const modules = join(path, "node_modules");
    if (!existsSync(modules)) {
      return lockfile
        ? "node_modules missing - in-repo worktrees can resolve dependencies from another checkout"
        : "node_modules missing and no supported lockfile exists - cannot prepare without changing project state";
    }
    if (!lockfile) return undefined;
    const marker = join(modules, ".devloop-envhash");
    if (!existsSync(marker)) return undefined;
    try {
      return readFileSync(marker, "utf8").trim() === hashFiles(path, ["package.json", lockfile[0]])
        ? undefined : "package.json or lockfile changed since devloop installed dependencies";
    } catch (error) { return `cannot read devloop environment fingerprint: ${String(error)}`; }
  }
  override markPrepared(path: string): void {
    const lockfile = this.lockfile(path);
    const modules = join(path, "node_modules");
    if (lockfile && existsSync(modules)) writeFileSync(join(modules, ".devloop-envhash"), hashFiles(path, ["package.json", lockfile[0]]));
  }
  override isTestFile(path: string): boolean { return /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(basename(path)); }
}

class PythonEcosystem extends BaseEcosystem {
  readonly name = "python";
  readonly manifests = ["pyproject.toml", "setup.py"];
  override matchesLanguage(path: string): boolean { return super.matchesLanguage(path) || existsSync(join(path, "requirements.txt")); }
  isUvManaged(path: string): boolean { return existsSync(join(path, "pyproject.toml")) && existsSync(join(path, "uv.lock")); }
  override prepareCommand(path: string): readonly string[] | undefined { return this.isUvManaged(path) ? ["uv", "sync", "--frozen"] : undefined; }
  override environmentProblem(path: string): string | undefined {
    if (!this.isUvManaged(path)) return undefined;
    const environment = join(path, ".venv");
    if (!existsSync(environment)) return ".venv missing - a stale VIRTUAL_ENV could run another checkout's editable install";
    const marker = join(environment, ".devloop-envhash");
    if (!existsSync(marker)) return undefined;
    try {
      return readFileSync(marker, "utf8").trim() === hashFiles(path, ["pyproject.toml", "uv.lock"])
        ? undefined : "pyproject.toml or uv.lock changed since devloop synced dependencies";
    } catch (error) { return `cannot read devloop environment fingerprint: ${String(error)}`; }
  }
  override markPrepared(path: string): void {
    const environment = join(path, ".venv");
    if (this.isUvManaged(path) && existsSync(environment)) writeFileSync(join(environment, ".devloop-envhash"), hashFiles(path, ["pyproject.toml", "uv.lock"]));
  }
  override isTestFile(path: string): boolean {
    const name = basename(path);
    return name.endsWith(".py") && (name.startsWith("test_") || name.endsWith("_test.py"));
  }
}

export const ECOSYSTEMS: readonly Ecosystem[] = [new PythonEcosystem(), new GoEcosystem(), new NodeEcosystem()];

export function detectEcosystem(path: string): Ecosystem | undefined {
  return ECOSYSTEMS.find((ecosystem) => ecosystem.manifests.some((manifest) => existsSync(join(path, manifest))));
}

export function detectLanguage(path: string): string | undefined {
  return ECOSYSTEMS.find((ecosystem) => ecosystem.matchesLanguage(path))?.language(path);
}

/** Prepare a component with the ecosystem's frozen install command. */
export function ensureEnvironmentReady(path: string): string | undefined {
  const ecosystem = detectEcosystem(path);
  if (!ecosystem) return undefined;
  const problem = ecosystem.environmentProblem(path);
  if (!problem) return undefined;
  const command = ecosystem.prepareCommand(path);
  if (!command?.[0]) return problem;
  const result = runCommand(command[0], command.slice(1), { cwd: path, timeoutMs: 600_000 });
  if (!result.ok) {
    const tail = `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-15).join("\n");
    return `${problem}; auto-prepare \`${command.join(" ")}\` failed (${result.code}):\n${tail}`;
  }
  try { ecosystem.markPrepared(path); } catch (error) { return `environment prepared but fingerprint could not be written: ${String(error)}`; }
  const remaining = ecosystem.environmentProblem(path);
  return remaining ? `environment prepared but is still not ready: ${remaining}` : undefined;
}

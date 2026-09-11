import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { detectEcosystem, detectLanguage } from "../lib/ecosystem.js";
import { runGit } from "../lib/process.js";

const SAFE_SCOPE = /^[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*$/;
const DISCOVERY_SKIP = new Set([".git", "node_modules", ".venv", "venv", "env", ".tox", "dist", "build", "target", "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".idea", ".vscode", "vendor"]);

/** Independently buildable and validatable directory within a repository. */
export class Component {
  readonly path: string;
  readonly id: string;
  readonly language: string | undefined;

  private constructor(path: string, id: string, language: string | undefined) {
    this.path = path; this.id = id; this.language = language;
  }

  static at(pathValue: string, gitRoot: string): Component {
    const path = realpathSync(pathValue);
    const root = realpathSync(gitRoot);
    const id = relative(root, path).replaceAll("\\", "/") || ".";
    return new Component(pathValue, id.startsWith("../") ? path.replaceAll("\\", "/") : id, detectLanguage(pathValue));
  }

  hasTarget(name: string, suffix = false): boolean {
    try {
      const makefile = readFileSync(join(this.path, "Makefile"), "utf8");
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`^${escaped}${suffix ? "(-\\w+)?" : ""}\\s*:`, "m").test(makefile);
    } catch { return false; }
  }

  lintTarget(): string | undefined { return ["lint-ci", "lint"].find((target) => this.hasTarget(target)); }
  testTarget(): string | undefined { return ["test", "test-ci", "test-local"].find((target) => this.hasTarget(target)); }
  testCommand(): readonly string[] | undefined {
    const target = this.testTarget();
    return target ? ["make", target] : detectEcosystem(this.path)?.fallbackTestCommand(this.path);
  }
  supportsLintFiles(): boolean { return this.makefileUses("LINT_FILES"); }
  supportsTestFiles(): boolean { return this.makefileUses("TEST_FILES"); }
  private makefileUses(variable: string): boolean {
    try { return new RegExp(`\\$\\(${variable}\\)|\\$\\{${variable}\\}`).test(readFileSync(join(this.path, "Makefile"), "utf8")); }
    catch { return false; }
  }
  focusedLintCommand(files: readonly string[], target = this.lintTarget()): readonly string[] | undefined {
    return target && files.length > 0 && this.supportsLintFiles() && files.every((path) => SAFE_SCOPE.test(path))
      ? ["make", target, `LINT_FILES=${files.join(" ")}`] : undefined;
  }
  focusedTestCommand(files: readonly string[]): readonly string[] | undefined {
    const target = this.testTarget();
    return target && files.length > 0 && this.supportsTestFiles() && files.every((path) => SAFE_SCOPE.test(path))
      ? ["make", target, `TEST_FILES=${files.join(" ")}`] : undefined;
  }
}

export function findGitRoot(path: string): string | undefined {
  const result = runGit(path, ["rev-parse", "--show-toplevel"], 3_000);
  return result.ok && result.stdout ? result.stdout : undefined;
}
export function isGitRepository(path: string): boolean { return findGitRoot(path) !== undefined; }

function isComponent(path: string): boolean { return detectEcosystem(path) !== undefined; }

export function defaultComponent(rootValue: string): Component {
  const root = resolve(rootValue);
  for (const name of ["server", "backend"]) {
    const candidate = join(root, name);
    if (existsSync(candidate) && isComponent(candidate)) return Component.at(candidate, root);
  }
  return Component.at(root, root);
}

export function findRepoCodeDirectory(rootValue: string): string {
  return defaultComponent(rootValue).path;
}

export function owningComponent(targetValue: string, rootValue: string): Component | undefined {
  const root = realpathSync(rootValue);
  const target = resolve(targetValue);
  let current: string;
  try { current = lstatSync(target).isDirectory() ? realpathSync(target) : dirname(realpathSync(target)); }
  catch { current = dirname(target); }
  let nested = current;
  while (nested !== root && nested.startsWith(`${root}/`)) {
    if (existsSync(join(nested, ".git"))) { current = dirname(nested); break; }
    nested = dirname(nested);
  }
  while (current !== root && current.startsWith(`${root}/`)) {
    if (isComponent(current)) return Component.at(current, rootValue);
    current = dirname(current);
  }
  return isComponent(root) ? Component.at(rootValue, rootValue) : undefined;
}

export function enclosingComponent(target: string, root: string): Component { return owningComponent(target, root) ?? defaultComponent(root); }

export function discoverComponents(rootValue: string, maxDepth = 4): readonly Component[] {
  const root = realpathSync(rootValue);
  const components: Component[] = [];
  const walk = (directory: string, depth: number): void => {
    if (depth > maxDepth) return;
    let names: string[];
    try { names = readdirSync(directory).sort(); } catch { return; }
    for (const name of names) {
      const path = join(directory, name);
      let stat;
      try { stat = lstatSync(path); } catch { continue; }
      if (name.startsWith(".") || DISCOVERY_SKIP.has(name) || stat.isSymbolicLink() || !stat.isDirectory() || existsSync(join(path, ".git"))) continue;
      if (isComponent(path)) components.push(Component.at(path, rootValue));
      else walk(path, depth + 1);
    }
  };
  if (isComponent(root)) components.push(Component.at(rootValue, rootValue));
  walk(root, 1);
  return components.length > 0 ? components : [defaultComponent(rootValue)];
}

export function findAgentsDocument(repo: string, component?: string): string | undefined {
  return [component ? join(component, "AGENTS.md") : "", join(repo, "AGENTS.md")].find((path) => path && existsSync(path));
}

/** Repository identity independent of the caller's current directory. */
export interface Repo { readonly name: string; readonly root: string; readonly components: readonly Component[] }
export function resolveRepo(path: string): Repo | undefined {
  const root = findGitRoot(resolve(path));
  return root ? { name: basename(root), root, components: discoverComponents(root) } : undefined;
}
export function containsPath(repo: Repo, path: string): boolean { const value = resolve(path); return value === resolve(repo.root) || value.startsWith(`${resolve(repo.root)}/`); }

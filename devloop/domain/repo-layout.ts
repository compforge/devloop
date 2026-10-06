import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { detectEcosystem } from "../lib/ecosystem.js";
import { inspectRepository, InspectionError, type ComponentInfo, type PackageTool } from "../lib/repocli.js";
import { runGit } from "../lib/process.js";

const SAFE_SCOPE = /^[A-Za-z0-9_./@+][A-Za-z0-9_./@+:-]*$/;

/** Independently buildable and validatable directory within a repository. */
export class Component {
  readonly path: string;
  readonly id: string;
  readonly language: string | undefined;

  private constructor(path: string, id: string, language: string | undefined, readonly name = "", readonly packageTools: readonly PackageTool[] = []) {
    this.path = path; this.id = id; this.language = language;
  }

  static at(pathValue: string, gitRoot: string): Component {
    const path = realpathSync(pathValue);
    const root = realpathSync(gitRoot);
    const id = relative(root, path).replaceAll("\\", "/") || ".";
    return new Component(pathValue, id.startsWith("../") ? path.replaceAll("\\", "/") : id, undefined);
  }

  static fromInfo(root: string, info: ComponentInfo): Component {
    return new Component(join(root, info.root), info.root, info.language, info.name, info.packageTools);
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

/** One operation's catalog; file ownership is a projection of declared roots. */
export class ComponentCatalog {
  readonly components: readonly Component[];
  constructor(readonly root: string) { this.components = inspectRepository(root).map((info) => Component.fromInfo(root, info)); }
  owner(target: string): Component | undefined {
    const path = resolve(target);
    return this.components.filter((c) => path === c.path || path.startsWith(c.path + "/")).sort((a, b) => b.path.length - a.path.length)[0];
  }
  default(): Component {
    for (const preferred of ["server", "backend", "."]) {
      const component = this.components.find((c) => c.id === preferred);
      if (component) return component;
    }
    if (this.components.length === 1) return this.components[0]!;
    throw new InspectionError("no default Component; select a declared component explicitly");
  }
}
export function inspectCatalog(root: string): ComponentCatalog { return new ComponentCatalog(realpathSync(root)); }
export function defaultComponent(root: string): Component { return inspectCatalog(root).default(); }
export function findRepoCodeDirectory(root: string): string { return defaultComponent(root).path; }
export function owningComponent(target: string, root: string, catalog = inspectCatalog(root)): Component | undefined { return catalog.owner(target); }
export function enclosingComponent(target: string, root: string, catalog = inspectCatalog(root)): Component { return catalog.owner(target) ?? catalog.default(); }
export function discoverComponents(root: string): readonly Component[] { return inspectCatalog(root).components; }

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

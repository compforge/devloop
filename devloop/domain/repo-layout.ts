import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { inspectRepository, InspectionError } from "../lib/repocli.js";
import { owner, type ComponentBinding, type InspectReport, type PackageTool } from "@compforge/repocli";
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

  static fromInfo(root: string, info: ComponentBinding): Component {
    return new Component(join(root, info.root), info.root, info.language, info.name, info.packageTools ?? []);
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
    return target ? ["make", target] : undefined;
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
  constructor(readonly root: string, private readonly report: InspectReport) { this.components = report.components.map((info) => Component.fromInfo(root, info)); }
  owner(target: string): Component | undefined {
    const path = relative(this.root, resolve(target)).replaceAll("\\", "/");
    if (path === ".." || path.startsWith("../")) return undefined;
    const binding = owner(this.report, path || ".");
    return binding ? this.components.find((component) => component.id === binding.root) : undefined;
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
export async function inspectCatalog(root: string): Promise<ComponentCatalog> {
  const checkout = realpathSync(root);
  return new ComponentCatalog(checkout, await inspectRepository(checkout));
}
export async function defaultComponent(root: string): Promise<Component> { return (await inspectCatalog(root)).default(); }
export async function findRepoCodeDirectory(root: string): Promise<string> { return (await defaultComponent(root)).path; }
export function owningComponent(target: string, catalog: ComponentCatalog): Component | undefined { return catalog.owner(target); }
export function enclosingComponent(target: string, catalog: ComponentCatalog): Component { return catalog.owner(target) ?? catalog.default(); }
export async function discoverComponents(root: string): Promise<readonly Component[]> { return (await inspectCatalog(root)).components; }

export function findAgentsDocument(repo: string, component?: string): string | undefined {
  return [component ? join(component, "AGENTS.md") : "", join(repo, "AGENTS.md")].find((path) => path && existsSync(path));
}

/** Repository identity independent of the caller's current directory. */
export interface Repo { readonly name: string; readonly root: string; readonly components: readonly Component[] }
export async function resolveRepo(path: string): Promise<Repo | undefined> {
  const root = findGitRoot(resolve(path));
  return root ? { name: basename(root), root, components: await discoverComponents(root) } : undefined;
}
export function containsPath(repo: Repo, path: string): boolean { const value = resolve(path); return value === resolve(repo.root) || value.startsWith(`${resolve(repo.root)}/`); }

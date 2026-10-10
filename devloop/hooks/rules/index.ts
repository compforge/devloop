import { fullEvidence, reusableFullEvidence } from "../../domain/validation-evidence.js";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { evaluateGate } from "../../domain/context/gate.js";
import { branchSegment, loadSegment } from "../../domain/context/store.js";
import { acquireOwner, foreignOwner, ownerDescription, repositoryName } from "../../domain/context/session.js";
import { pullRequestLabel } from "../../domain/forge.js";
import { enclosingComponent, findGitRoot } from "../../domain/repo-layout.js";
import { componentFingerprint, selectComponents } from "../../domain/repo.js";
import { workspaces } from "../../lib/config.js";
import { lifecycleConfig, type JsonObject } from "../../lib/config.js";
import { currentBranch, listCheckouts } from "../../lib/git-state.js";
import { runGit } from "../../lib/process.js";
import { WorkspaceContext } from "../../domain/context/workspace.js";
import type { Change, CommandTarget, FileChangeTarget, Finding, Target } from "../core/domain.js";
import type { Rule } from "../core/rule.js";

function command(target: Target | Change): CommandTarget { return target as CommandTarget; }
function file(target: Target | Change): FileChangeTarget { return target as FileChangeTarget; }
function finding(rule: string, message: string, locator = ""): readonly Finding[] { return [{ rule, severity: "deny", message, ...(locator ? { locator } : {}) }]; }
function commandLine(target: CommandTarget): string { return target.argv.join(" "); }

const addAll: Rule = {
  name: "add-all", targetKind: "command",
  applies: (target) => command(target).subcommand === "add",
  check: (target) => command(target).args.some((arg) => ["-A", "--all", ".", "./"].includes(arg))
    ? finding("add-all", "Refusing broad `git add`. Stage explicit paths or use the devloop commit flow so unrelated and sensitive files cannot be captured.", commandLine(command(target))) : [],
};

const worktreeAdd: Rule = {
  name: "worktree-add", targetKind: "command",
  applies: (target) => command(target).subcommand === "worktree" && command(target).args[0] === "add",
  check: (target) => {
    const runDirectory = command(target).workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
    let primary = repo ?? "<repo>";
    // Topology only improves the suggested command; lookup failure cannot waive the rule.
    try { if (repo) primary = listCheckouts(repo).find(entry => entry.primary)?.path ?? repo; }
    catch { /* Use the known invocation repository in the guidance. */ }
    return finding("worktree-add", `Direct \`git worktree add\` bypasses devloop lifecycle policy. Use \`"<PLUGIN_ROOT>/scripts/python" "<PLUGIN_ROOT>/scripts/checkout.py" ${basename(primary)} --worktree <tag>\`.`, commandLine(command(target)));
  },
};

function tagOnlyPush(args: readonly string[], repo: string): boolean {
  if (args.some((arg) => ["--all", "--branches", "--mirror", "--follow-tags", "--delete", "-d"].includes(arg))) return false;
  if (args.includes("--tags")) return true;
  const positional = args.filter((arg) => !arg.startsWith("-"));
  const refspecs = positional.slice(1);
  return refspecs.length > 0 && refspecs.every((raw) => {
    const spec = raw.replace(/^\+/, "");
    if (spec.includes(":")) { const [source, destination] = spec.split(":"); return Boolean(source) && destination?.startsWith("refs/tags/") === true; }
    if (spec.startsWith("refs/tags/")) return true;
    return runGit(repo, ["show-ref", "--verify", "--quiet", `refs/tags/${spec}`]).ok
      && !runGit(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${spec}`]).ok;
  });
}

const protectBranch: Rule = {
  name: "protect-branch", failurePolicy: "fail_closed", targetKind: "command",
  applies: (target) => ["commit", "push"].includes(command(target).subcommand ?? ""),
  check: (target) => {
    const value = command(target); const runDirectory = value.workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
    if (!repo) return [];
    const gate = evaluateGate(repo);
    if (!gate.protected || value.subcommand === "push" && tagOnlyPush(value.args, repo)) return [];
    return finding("protect-branch", `Refusing \`git commit/push\` on protected branch '${gate.branch ?? "?"}'. Create a feature branch with the devloop branch command first.`, commandLine(value));
  },
};

const checkoutOwner: Rule = {
  name: "checkout-owner", failurePolicy: "fail_closed", targetKind: "command",
  applies: (target) => command(target).subcommand === "switch" || command(target).subcommand === "checkout" && !command(target).args.includes("--"),
  check: (target, context) => {
    if (!context.sessionId) return [];
    const runDirectory = command(target).workingDirectory.path;
    const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
    if (!repo) return [];
    const owner = foreignOwner(repo, context.sessionId, context.harness);
    if (owner) return finding("checkout-owner", `This checkout is owned by another devloop session (${ownerDescription(owner)}). Use the managed-worktree helper for '${repositoryName(repo)}'.`, commandLine(command(target)));
    acquireOwner(repo, context.identity, currentBranch(repo) ?? "");
    return [];
  },
};

function pipInstallArgs(argv: readonly string[]): readonly string[] | undefined {
  const base = basename(argv[0] ?? "");
  const index = argv.indexOf("install");
  if ((base === "pip" || base === "pip3") && index > 0) return argv.slice(index + 1);
  if (base.startsWith("python") && argv[1] === "-m" && argv[2] === "pip" && index >= 3) return argv.slice(index + 1);
  return undefined;
}

const pipInstall: Rule = {
  name: "pip-install", targetKind: "command", applies: () => true,
  check: async (target, context) => {
    const value = command(target); const args = pipInstallArgs(value.argv);
    if (!args || args.includes("-e") && args.includes(".")) return [];
    const runDirectory = value.workingDirectory.path; const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
    if (!repo) return [];
    const catalog = await context.catalog(repo);
    if (catalog.components.length === 0) return [];
    const component = enclosingComponent(runDirectory!, catalog).path;
    if (!existsSync(join(component, "pyproject.toml")) || !existsSync(join(component, "uv.lock"))) return [];
    return finding("pip-install", "This component is uv-managed. Use `uv add` or `uv sync`; direct `pip install` bypasses pyproject.toml and uv.lock.", commandLine(value));
  },
};

function pytestInvocation(argv: readonly string[]): boolean {
  let args = [...argv];
  if (args[0] === "uv" && args[1] === "run") args = args.slice(2);
  const base = basename(args[0] ?? "");
  return base === "pytest" || base.startsWith("python") && args[1] === "-m" && args[2] === "pytest";
}

const pytestNaked: Rule = {
  name: "pytest-naked", targetKind: "command",
  applies: (target) => command(target).environment.length === 0 && pytestInvocation(command(target).argv),
  check: async (target, context) => {
    const value = command(target); const runDirectory = value.workingDirectory.path; const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
    if (!repo) return [];
    const catalog = await context.catalog(repo);
    if (catalog.components.length === 0) return [];
    const component = enclosingComponent(runDirectory!, catalog);
    return component.hasTarget("test", true)
      ? finding("pytest-naked", `Use the project's canonical test target: cd ${component.path} && make test`, commandLine(value)) : [];
  },
};

const PROJECT_COMMANDS: Readonly<Record<string, ReadonlySet<string>>> = {
  npm: new Set(["ci", "install", "run", "start", "test", "publish"]),
  pnpm: new Set(["add", "build", "check", "install", "lint", "run", "test"]),
  yarn: new Set(["add", "build", "install", "lint", "run", "test"]),
  uv: new Set(["add", "build", "lock", "run", "sync", "tree", "venv"]),
  go: new Set(["build", "fmt", "generate", "get", "list", "mod", "run", "test", "vet", "work"]),
  cargo: new Set(["bench", "build", "check", "clippy", "fmt", "run", "test"]),
};
function projectLocal(value: CommandTarget): boolean {
  const base = basename(value.argv[0] ?? "");
  if (base === "pytest") return true;
  if (base === "make") return !value.args.every((arg) => ["-h", "--help", "-v", "--version", "help"].includes(arg));
  if (["npm", "pnpm"].includes(base) && value.argv.some((arg) => arg === "-g" || arg === "--global")) return false;
  const subcommand = value.argv.slice(1).find((arg) => !arg.startsWith("-"));
  return subcommand !== undefined && PROJECT_COMMANDS[base]?.has(subcommand) === true;
}
function workspaceRoot(path: string): boolean { return workspaces().some((root) => resolve(root) === resolve(path)) || WorkspaceContext.load(path) !== undefined && !findGitRoot(path); }

const workspaceCwd: Rule = {
  name: "workspace-cwd", targetKind: "command", applies: (target) => projectLocal(command(target)),
  check: (target) => {
    const path = command(target).workingDirectory.path;
    if (!path || !workspaceRoot(path)) return [];
    const names = WorkspaceContext.load(path)?.subprojects.slice(0, 10).map((item) => item.name).join(", ");
    return finding("workspace-cwd", `You're at aggregate workspace '${resolve(path)}', not a subproject. Enter a repository or pass --repo explicitly.${names ? ` Subprojects: ${names}` : ""}`, commandLine(command(target)));
  },
};

const editOwner: Rule = {
  name: "edit-owner", failurePolicy: "fail_closed", targetKind: "file_change", applies: () => true,
  check: (target, context) => {
    if (!context.sessionId || !context.gitRoot) return [];
    const repo = context.gitRoot; const owner = foreignOwner(repo, context.sessionId, context.harness);
    if (owner) {
      const path = context.anchorPath || file(target).path;
      if (runGit(repo, ["check-ignore", "-q", "--", path]).ok) return [];
      return finding("edit-owner", `Checkout '${repositoryName(repo)}' is owned by another devloop session (${ownerDescription(owner)}). Use an isolated managed worktree.`, file(target).path);
    }
    acquireOwner(repo, context.identity, currentBranch(repo) ?? ""); return [];
  },
};

const branchMerged: Rule = {
  name: "branch-merged", failurePolicy: "fail_closed", targetKind: "file_change", applies: () => true,
  check: (target, context) => {
    if (!context.gitRoot) return [];
    const gate = evaluateGate(context.gitRoot); const pr = gate.activePullRequest;
    return gate.inactive
      ? finding("branch-merged", `Branch '${gate.branch ?? "?"}' is inactive (${pr ? `${pullRequestLabel(gate.provider, pr.number)} ${pr.state}` : "PR/MR finished"}). Cut a new branch from origin/${gate.target} before editing.`, file(target).path) : [];
  },
};

const requirementsEdit: Rule = {
  name: "requirements-edit", targetKind: "file_change", applies: () => true,
  check: (target, context) => {
    const path = context.anchorPath || file(target).path;
    if (basename(path) !== "requirements.txt") return [];
    const parent = dirname(path);
    return existsSync(join(parent, "pyproject.toml")) || existsSync(join(dirname(parent), "pyproject.toml"))
      ? finding("requirements-edit", `\`${path}\` is generated dependency output. Edit pyproject.toml, then regenerate it with uv.`, file(target).path) : [];
  },
};

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

// Only commands that consume the current index can use its validation evidence.
// Path operands and unknown options go through the managed candidate transaction.
function commitsExistingIndex(args: readonly string[]): boolean {
  const values = new Set(["-m", "--message", "-F", "--file", "-C", "--reuse-message", "-c", "--reedit-message", "--author", "--date", "--cleanup"]);
  const flags = new Set(["--amend", "--no-edit", "--edit", "-e", "--signoff", "-s", "--no-verify", "-n", "--quiet", "-q", "--verbose", "-v", "--allow-empty", "--allow-empty-message", "--no-gpg-sign", "--no-post-rewrite"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (values.has(arg)) { if (++index >= args.length) return false; continue; }
    if (flags.has(arg) || [...values].some((option) => option.startsWith("--") && arg.startsWith(`${option}=`))) continue;
    return false;
  }
  return true;
}

const precommitGate: Rule = {
  name: "precommit-gate", targetKind: "command", failurePolicy: "fail_closed",
  applies: (target) => command(target).subcommand === "commit",
  check: async (target, context) => {
    const value = command(target); const directory = value.workingDirectory.path;
    const repo = directory ? findGitRoot(directory) : undefined;
    if (!repo || !stringArray(lifecycleConfig(repo).pre_commit).includes("lint")) return [];
    const branch = currentBranch(repo);
    const lint = loadSegment(repo, branchSegment(branch, "lint")) ?? {};
    const catalog = await context.catalog(repo);
    const required = selectComponents(repo, { catalog }).components;
    const fingerprint = required.length ? await componentFingerprint(repo, required[0]!, catalog) : undefined;
    const stale = required.flatMap((component): string[] => {
      if (!component.lintTarget()) return [`  ${component.id}: lint entrypoint unavailable.`];
      const evidence = fullEvidence(repo, component.id, "lint", lint[component.id]);
      if (!evidence) return [`  ${component.id}: lint has no full-check evidence for this branch.`];
      return reusableFullEvidence(evidence, fingerprint, ["make", component.lintTarget()!, "LINT_FILES="])
        ? [] : [`  ${component.id}: contents, command or dependency environment require validation.`];
    });
    const unstaged = runGit(repo, ["diff", "--quiet", "--ignore-submodules=dirty"]);
    const untracked = runGit(repo, ["ls-files", "--others", "--exclude-standard"]);
    if (!commitsExistingIndex(value.args) || !unstaged.ok || !untracked.ok || untracked.stdout) {
      stale.push("  index differs from the checked working tree; use the devloop commit flow.");
    }
    return stale.length === 0 ? [] : finding("precommit-gate", [
      "Refusing `git commit`: lint is in the pre_commit gate and is stale.",
      ...stale,
      "Commit via gcam/gcampr instead, or run the validate skill, then retry.",
      "Adjust the gate under `lifecycle` in ~/.devloop/config.json.",
    ].join("\n"), commandLine(value));
  },
};

function resultingText(target: FileChangeTarget): string | undefined {
  const input = target.toolInput;
  if (!input) return undefined;
  if (typeof input.content === "string") return input.content;
  if (typeof input.file_text === "string") return input.file_text;
  let current: string;
  try { current = readFileSync(target.path, "utf8"); } catch { current = ""; }
  if (Array.isArray(input.edits)) {
    for (const raw of input.edits) {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
      const edit = raw as Record<string, unknown>;
      if (typeof edit.old_string === "string") current = current.replace(edit.old_string, typeof edit.new_string === "string" ? edit.new_string : "");
    }
    return current;
  }
  const oldText = typeof input.old_string === "string" ? input.old_string : typeof input.old_str === "string" ? input.old_str : undefined;
  const newText = typeof input.new_string === "string" ? input.new_string : typeof input.new_str === "string" ? input.new_str : "";
  if (oldText === undefined) return current;
  return input.replace_all === true ? current.split(oldText).join(newText) : current.replace(oldText, newText);
}

function layerOf(value: string, layers: JsonObject): string | undefined {
  for (const [fragment, layer] of Object.entries(layers)) if (typeof layer === "string" && value.includes(fragment)) return layer;
  return undefined;
}

function importedModules(source: string, extension: string): readonly string[] {
  const patterns = extension === ".py"
    ? [/^\s*import\s+([\w.]+)/gm, /^\s*from\s+([\w.]+)\s+import\s+/gm]
    : [/(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']\s*\)/g];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1] ?? "")).filter(Boolean);
}

function importLayer(module: string, order: readonly string[]): string | undefined {
  const segments = new Set(module.split(/[./\\]/));
  return order.find((layer) => segments.has(layer));
}

const layerDeps: Rule = {
  name: "layer-deps", targetKind: "file_change",
  applies: (_target, context) => context.architecture.enabled === true && stringArray(context.architecture.order).length > 0,
  check: (target, context) => {
    const value = file(target); const config = context.architecture;
    const layers = config.layers !== null && typeof config.layers === "object" && !Array.isArray(config.layers) ? config.layers as JsonObject : {};
    const order = stringArray(config.order); const ownLayer = layerOf(value.path, layers);
    const text = resultingText(value);
    if (!ownLayer || text === undefined || !order.includes(ownLayer)) return [];
    const rank = new Map(order.map((layer, index) => [layer, index]));
    return importedModules(text, extname(value.path).toLowerCase()).flatMap((module): Finding[] => {
      const dependency = importLayer(module, order);
      return dependency && dependency !== ownLayer && rank.get(dependency)! < rank.get(ownLayer)!
        ? [{ rule: "layer-deps", severity: "deny", message: `Layer violation: ${ownLayer} file ${value.path} must not depend on higher layer ${dependency} (import: ${module}). Move cross-layer orchestration to ${dependency}.`, locator: value.path }]
        : [];
    });
  },
};

export const RULES: readonly Rule[] = [protectBranch, checkoutOwner, worktreeAdd, addAll, workspaceCwd, pytestNaked, pipInstall, precommitGate, editOwner, branchMerged, requirementsEdit, layerDeps];

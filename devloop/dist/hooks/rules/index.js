import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { evaluateGate } from "../../domain/context/gate.js";
import { branchSegment, loadSegment } from "../../domain/context/store.js";
import { acquireOwner, foreignOwner, ownerDescription, repositoryName } from "../../domain/context/session.js";
import { pullRequestLabel } from "../../domain/forge.js";
import { enclosingComponent, findGitRoot } from "../../domain/repo-layout.js";
import { componentFingerprint, selectComponents } from "../../domain/repo.js";
import { workspaces } from "../../lib/config.js";
import { lifecycleConfig } from "../../lib/config.js";
import { currentBranch, listWorktrees } from "../../lib/git-state.js";
import { runGit } from "../../lib/process.js";
import { WorkspaceContext } from "../../domain/context/workspace.js";
function command(target) { return target; }
function file(target) { return target; }
function finding(rule, message, locator = "") { return [{ rule, severity: "deny", message, ...(locator ? { locator } : {}) }]; }
function commandLine(target) { return target.argv.join(" "); }
const addAll = {
    name: "add-all", targetKind: "command",
    applies: (target) => command(target).subcommand === "add",
    check: (target) => command(target).args.some((arg) => ["-A", "--all", ".", "./"].includes(arg))
        ? finding("add-all", "Refusing broad `git add`. Stage explicit paths or use the devloop commit flow so unrelated and sensitive files cannot be captured.", commandLine(command(target))) : [],
};
const worktreeAdd = {
    name: "worktree-add", targetKind: "command",
    applies: (target) => command(target).subcommand === "worktree" && command(target).args[0] === "add",
    check: (target) => {
        const runDirectory = command(target).workingDirectory.path;
        const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
        const primary = repo ? listWorktrees(repo)[0]?.path ?? repo : "<repo>";
        return finding("worktree-add", `Direct \`git worktree add\` bypasses devloop lifecycle policy. Use \`python3 "<PLUGIN_ROOT>/scripts/checkout.py" ${basename(primary)} --worktree <tag>\`.`, commandLine(command(target)));
    },
};
function tagOnlyPush(args, repo) {
    if (args.some((arg) => ["--all", "--branches", "--mirror", "--follow-tags", "--delete", "-d"].includes(arg)))
        return false;
    if (args.includes("--tags"))
        return true;
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const refspecs = positional.slice(1);
    return refspecs.length > 0 && refspecs.every((raw) => {
        const spec = raw.replace(/^\+/, "");
        if (spec.includes(":")) {
            const [source, destination] = spec.split(":");
            return Boolean(source) && destination?.startsWith("refs/tags/") === true;
        }
        if (spec.startsWith("refs/tags/"))
            return true;
        return runGit(repo, ["show-ref", "--verify", "--quiet", `refs/tags/${spec}`]).ok
            && !runGit(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${spec}`]).ok;
    });
}
const protectBranch = {
    name: "protect-branch", targetKind: "command",
    applies: (target) => ["commit", "push"].includes(command(target).subcommand ?? ""),
    check: (target) => {
        const value = command(target);
        const runDirectory = value.workingDirectory.path;
        const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
        if (!repo)
            return [];
        const gate = evaluateGate(repo);
        if (!gate.protected || value.subcommand === "push" && tagOnlyPush(value.args, repo))
            return [];
        return finding("protect-branch", `Refusing \`git commit/push\` on protected branch '${gate.branch ?? "?"}'. Create a feature branch with the devloop branch command first.`, commandLine(value));
    },
};
const checkoutOwner = {
    name: "checkout-owner", targetKind: "command",
    applies: (target) => command(target).subcommand === "switch" || command(target).subcommand === "checkout" && !command(target).args.includes("--"),
    check: (target, context) => {
        if (!context.sessionId)
            return [];
        const runDirectory = command(target).workingDirectory.path;
        const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
        if (!repo)
            return [];
        const owner = foreignOwner(repo, context.sessionId, context.harness);
        if (owner)
            return finding("checkout-owner", `This checkout is owned by another devloop session (${ownerDescription(owner)}). Use the managed-worktree helper for '${repositoryName(repo)}'.`, commandLine(command(target)));
        acquireOwner(repo, context.identity, currentBranch(repo) ?? "");
        return [];
    },
};
function pipInstallArgs(argv) {
    const base = basename(argv[0] ?? "");
    const index = argv.indexOf("install");
    if ((base === "pip" || base === "pip3") && index > 0)
        return argv.slice(index + 1);
    if (base.startsWith("python") && argv[1] === "-m" && argv[2] === "pip" && index >= 3)
        return argv.slice(index + 1);
    return undefined;
}
const pipInstall = {
    name: "pip-install", targetKind: "command", applies: () => true,
    check: (target) => {
        const value = command(target);
        const args = pipInstallArgs(value.argv);
        if (!args || args.includes("-e") && args.includes("."))
            return [];
        const runDirectory = value.workingDirectory.path;
        const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
        if (!repo)
            return [];
        const component = enclosingComponent(runDirectory, repo).path;
        if (!existsSync(join(component, "pyproject.toml")) || !existsSync(join(component, "uv.lock")))
            return [];
        return finding("pip-install", "This component is uv-managed. Use `uv add` or `uv sync`; direct `pip install` bypasses pyproject.toml and uv.lock.", commandLine(value));
    },
};
function pytestInvocation(argv) {
    let args = [...argv];
    if (args[0] === "uv" && args[1] === "run")
        args = args.slice(2);
    const base = basename(args[0] ?? "");
    return base === "pytest" || base.startsWith("python") && args[1] === "-m" && args[2] === "pytest";
}
const pytestNaked = {
    name: "pytest-naked", targetKind: "command",
    applies: (target) => command(target).environment.length === 0 && pytestInvocation(command(target).argv),
    check: (target) => {
        const value = command(target);
        const runDirectory = value.workingDirectory.path;
        const repo = runDirectory ? findGitRoot(runDirectory) : undefined;
        if (!repo)
            return [];
        const component = enclosingComponent(runDirectory, repo);
        return component.hasTarget("test", true)
            ? finding("pytest-naked", `Use the project's canonical test target: cd ${component.path} && make test`, commandLine(value)) : [];
    },
};
const PROJECT_COMMANDS = {
    npm: new Set(["ci", "install", "run", "start", "test", "publish"]),
    pnpm: new Set(["add", "build", "check", "install", "lint", "run", "test"]),
    yarn: new Set(["add", "build", "install", "lint", "run", "test"]),
    uv: new Set(["add", "build", "lock", "run", "sync", "tree", "venv"]),
    go: new Set(["build", "fmt", "generate", "get", "list", "mod", "run", "test", "vet", "work"]),
    cargo: new Set(["bench", "build", "check", "clippy", "fmt", "run", "test"]),
};
function projectLocal(value) {
    const base = basename(value.argv[0] ?? "");
    if (base === "pytest")
        return true;
    if (base === "make")
        return !value.args.every((arg) => ["-h", "--help", "-v", "--version", "help"].includes(arg));
    if (["npm", "pnpm"].includes(base) && value.argv.some((arg) => arg === "-g" || arg === "--global"))
        return false;
    const subcommand = value.argv.slice(1).find((arg) => !arg.startsWith("-"));
    return subcommand !== undefined && PROJECT_COMMANDS[base]?.has(subcommand) === true;
}
function workspaceRoot(path) { return workspaces().some((root) => resolve(root) === resolve(path)) || WorkspaceContext.load(path) !== undefined && !findGitRoot(path); }
const workspaceCwd = {
    name: "workspace-cwd", targetKind: "command", applies: (target) => projectLocal(command(target)),
    check: (target) => {
        const path = command(target).workingDirectory.path;
        if (!path || !workspaceRoot(path))
            return [];
        const names = WorkspaceContext.load(path)?.subprojects.slice(0, 10).map((item) => item.name).join(", ");
        return finding("workspace-cwd", `You're at aggregate workspace '${resolve(path)}', not a subproject. Enter a repository or pass --repo explicitly.${names ? ` Subprojects: ${names}` : ""}`, commandLine(command(target)));
    },
};
const editOwner = {
    name: "edit-owner", targetKind: "file_change", applies: () => true,
    check: (target, context) => {
        if (!context.sessionId || !context.gitRoot)
            return [];
        const repo = context.gitRoot;
        const owner = foreignOwner(repo, context.sessionId, context.harness);
        if (owner) {
            const path = context.anchorPath || file(target).path;
            if (runGit(repo, ["check-ignore", "-q", "--", path]).ok)
                return [];
            return finding("edit-owner", `Checkout '${repositoryName(repo)}' is owned by another devloop session (${ownerDescription(owner)}). Use an isolated managed worktree.`, file(target).path);
        }
        acquireOwner(repo, context.identity, currentBranch(repo) ?? "");
        return [];
    },
};
const branchMerged = {
    name: "branch-merged", targetKind: "file_change", applies: () => true,
    check: (target, context) => {
        if (!context.gitRoot)
            return [];
        const gate = evaluateGate(context.gitRoot);
        const pr = gate.activePullRequest;
        return gate.inactive
            ? finding("branch-merged", `Branch '${gate.branch ?? "?"}' is inactive (${pr ? `${pullRequestLabel(gate.provider, pr.number)} ${pr.state}` : "PR/MR finished"}). Cut a new branch from origin/${gate.target} before editing.`, file(target).path) : [];
    },
};
const requirementsEdit = {
    name: "requirements-edit", targetKind: "file_change", applies: () => true,
    check: (target, context) => {
        const path = context.anchorPath || file(target).path;
        if (basename(path) !== "requirements.txt")
            return [];
        const parent = dirname(path);
        return existsSync(join(parent, "pyproject.toml")) || existsSync(join(dirname(parent), "pyproject.toml"))
            ? finding("requirements-edit", `\`${path}\` is generated dependency output. Edit pyproject.toml, then regenerate it with uv.`, file(target).path) : [];
    },
};
function stringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
const precommitGate = {
    name: "precommit-gate", targetKind: "command",
    applies: (target) => command(target).subcommand === "commit",
    check: (target) => {
        const value = command(target);
        const directory = value.workingDirectory.path;
        const repo = directory ? findGitRoot(directory) : undefined;
        if (!repo || !stringArray(lifecycleConfig(repo).pre_commit).includes("lint"))
            return [];
        const branch = currentBranch(repo);
        const lint = loadSegment(repo, branchSegment(branch, "lint")) ?? {};
        const required = selectComponents(repo).components.filter((component) => component.lintTarget() !== undefined);
        const stale = required.flatMap((component) => {
            const raw = lint[component.id];
            const stamp = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
            if (typeof stamp.passed_at !== "number")
                return [`  ${component.id}: lint has never run for this branch.`];
            const fingerprint = componentFingerprint(repo, component);
            return !fingerprint || typeof stamp.fingerprint !== "string" || stamp.fingerprint !== fingerprint
                ? [`  ${component.id}: content changed since its last lint pass.`] : [];
        });
        return stale.length === 0 ? [] : finding("precommit-gate", [
            "Refusing `git commit`: lint is in the pre_commit gate and is stale.",
            ...stale,
            "Commit via gcam/gcampr instead, or run the validate skill, then retry.",
            "Adjust the gate under `lifecycle` in ~/.devloop/config.json.",
        ].join("\n"), commandLine(value));
    },
};
function resultingText(target) {
    const input = target.toolInput;
    if (!input)
        return undefined;
    if (typeof input.content === "string")
        return input.content;
    if (typeof input.file_text === "string")
        return input.file_text;
    let current;
    try {
        current = readFileSync(target.path, "utf8");
    }
    catch {
        current = "";
    }
    if (Array.isArray(input.edits)) {
        for (const raw of input.edits) {
            if (raw === null || typeof raw !== "object" || Array.isArray(raw))
                continue;
            const edit = raw;
            if (typeof edit.old_string === "string")
                current = current.replace(edit.old_string, typeof edit.new_string === "string" ? edit.new_string : "");
        }
        return current;
    }
    const oldText = typeof input.old_string === "string" ? input.old_string : typeof input.old_str === "string" ? input.old_str : undefined;
    const newText = typeof input.new_string === "string" ? input.new_string : typeof input.new_str === "string" ? input.new_str : "";
    if (oldText === undefined)
        return current;
    return input.replace_all === true ? current.split(oldText).join(newText) : current.replace(oldText, newText);
}
function layerOf(value, layers) {
    for (const [fragment, layer] of Object.entries(layers))
        if (typeof layer === "string" && value.includes(fragment))
            return layer;
    return undefined;
}
function importedModules(source, extension) {
    const patterns = extension === ".py"
        ? [/^\s*import\s+([\w.]+)/gm, /^\s*from\s+([\w.]+)\s+import\s+/gm]
        : [/(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']\s*\)/g];
    return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1] ?? "")).filter(Boolean);
}
function importLayer(module, order) {
    const segments = new Set(module.split(/[./\\]/));
    return order.find((layer) => segments.has(layer));
}
const layerDeps = {
    name: "layer-deps", targetKind: "file_change",
    applies: (_target, context) => context.architecture.enabled === true && stringArray(context.architecture.order).length > 0,
    check: (target, context) => {
        const value = file(target);
        const config = context.architecture;
        const layers = config.layers !== null && typeof config.layers === "object" && !Array.isArray(config.layers) ? config.layers : {};
        const order = stringArray(config.order);
        const ownLayer = layerOf(value.path, layers);
        const text = resultingText(value);
        if (!ownLayer || text === undefined || !order.includes(ownLayer))
            return [];
        const rank = new Map(order.map((layer, index) => [layer, index]));
        return importedModules(text, extname(value.path).toLowerCase()).flatMap((module) => {
            const dependency = importLayer(module, order);
            return dependency && dependency !== ownLayer && rank.get(dependency) < rank.get(ownLayer)
                ? [{ rule: "layer-deps", severity: "deny", message: `Layer violation: ${ownLayer} file ${value.path} must not depend on higher layer ${dependency} (import: ${module}). Move cross-layer orchestration to ${dependency}.`, locator: value.path }]
                : [];
        });
    },
};
export const RULES = [protectBranch, checkoutOwner, worktreeAdd, addAll, workspaceCwd, pytestNaked, pipInstall, precommitGate, editOwner, branchMerged, requirementsEdit, layerDeps];
//# sourceMappingURL=index.js.map
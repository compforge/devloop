import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { architectureConfig, pullRequestTarget, lifecycleConfig, loadConfig, saveConfig, workspaces } from "../lib/config.js";
import { runGit } from "@compforge/repokit";

let root: string;
let repo: string;

function git(cwd: string, ...args: string[]): void {
  const result = runGit(cwd, ["-c", "core.hooksPath=/dev/null", ...args]);
  if (!result.ok) throw new Error(result.stderr);
}

function localConfig(directory: string, data: unknown): void {
  mkdirSync(join(directory, ".devloop"), { recursive: true });
  writeFileSync(join(directory, ".devloop", "config.json"), JSON.stringify(data));
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-config-")));
  repo = join(root, "repo");
  mkdirSync(repo);
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-qm", "init");
  saveConfig({
    lifecycle: { default: { pre_commit: ["review", "custom"], post_commit: ["review"] }, repos: { [repo]: { pre_commit: [] } } },
    arch: { repos: { [repo]: { enabled: true, layers: { "/domain/": "domain" } } } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("repository policy inheritance", () => {
  it.each(["nested", "external"])("inherits all local configuration in a %s worktree", (location) => {
    const checkout = location === "nested" ? join(repo, ".worktrees", "fix") : join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    localConfig(root, { review: { tool: "ancestor", options: { verbose: true } } });
    localConfig(repo, {
      review: { tool: "main" },
      pull_request: { target_repository: "upstream/repo" },
    });
    expect(loadConfig(checkout).review).toEqual({ tool: "main", options: { verbose: true } });
    expect(pullRequestTarget(checkout)).toBe("upstream/repo");
    localConfig(checkout, {
      review: { options: { verbose: false } },
      pull_request: { target_repository: "" },
    });
    expect(loadConfig(checkout).review).toEqual({ tool: "main", options: { verbose: false } });
    expect(loadConfig(repo).review).toEqual({ tool: "main", options: { verbose: true } });
    expect(pullRequestTarget(checkout)).toBeUndefined();
  });

  it("lets closer source defaults override global path-keyed policy", () => {
    const checkout = join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    localConfig(repo, { lifecycle: { default: { pre_commit: ["test"] } }, arch: { default: { enabled: false } } });
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: ["test"], post_commit: ["review"] });
    expect(architectureConfig(checkout).enabled).toBe(false);
    localConfig(checkout, { lifecycle: { default: { pre_commit: [] } }, arch: { default: { order: [] } } });
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: [], post_commit: ["review"] });
    expect(architectureConfig(checkout)).toMatchObject({ enabled: false, order: [] });
    expect(loadConfig(checkout).lifecycle).toMatchObject({ default: lifecycleConfig(checkout) });
  });

  it("resolves default and path overrides inside each source only once", () => {
    const checkout = join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    saveConfig({ lifecycle: {
      default: { pre_commit: ["review"], post_commit: ["review"] },
      repos: { [repo]: { pre_commit: [] }, [checkout]: { pre_commit: ["test"] } },
    } });
    expect(lifecycleConfig(checkout).pre_commit).toEqual(["test"]);
    localConfig(checkout, { lifecycle: { default: { pre_commit: [] } } });
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: [], post_commit: ["review"] });
  });

  it("keeps workspace registration global and credential environment overrides explicit", () => {
    saveConfig({ workspaces: ["/global"], pull_request: { target_repository: "upstream/repo" } });
    localConfig(repo, { workspaces: ["/local"], pull_request: { target_repository: "fork/repo" } });
    expect(loadConfig(repo).workspaces).toEqual(["/global"]);
    expect(workspaces()).toEqual(["/global"]);
    expect(pullRequestTarget(repo)).toBe("fork/repo");
  });

  it("falls back to main-repository configuration when a local file is invalid", () => {
    const checkout = join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    localConfig(repo, { review: { tool: "main" } });
    localConfig(checkout, {});
    writeFileSync(join(checkout, ".devloop", "config.json"), "invalid json");
    expect(loadConfig(checkout).review).toEqual({ tool: "main" });
  });

  it.each(["nested", "external"])("inherits the main repository policy in a %s worktree", (location) => {
    const checkout = location === "nested" ? join(repo, ".worktrees", "fix") : join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    expect(lifecycleConfig(checkout)).toEqual(lifecycleConfig(repo));
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: [], post_commit: ["review"] });
    expect(architectureConfig(checkout)).toEqual(architectureConfig(repo));
  });

  it("lets explicit checkout policy override inherited fields without losing other phases", () => {
    const checkout = join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    mkdirSync(join(checkout, ".devloop"));
    writeFileSync(join(checkout, ".devloop", "config.json"), JSON.stringify({
      lifecycle: { repos: { [checkout]: { pre_commit: ["test"] } } },
      arch: { repos: { [checkout]: { enabled: false } } },
    }));
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: ["test"], post_commit: ["review"] });
    expect(lifecycleConfig(repo).pre_commit).toEqual([]);
    expect(architectureConfig(checkout)).toMatchObject({ enabled: false, layers: { "/domain/": "domain" } });
  });

  it("does not inherit a parent repository policy into a submodule", () => {
    const source = join(root, "source");
    git(root, "clone", "-q", repo, source);
    git(repo, "-c", "protocol.file.allow=always", "submodule", "add", "-q", source, "child");
    expect(lifecycleConfig(join(repo, "child")).pre_commit).toEqual(["review", "custom"]);
  });

  it("resolves worktrees of repositories with a separate git directory", () => {
    git(repo, "init", "-q", "--separate-git-dir", join(root, "metadata"));
    git(repo, "config", "core.worktree", repo);
    const checkout = join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    expect(lifecycleConfig(checkout).pre_commit).toEqual([]);
  });

  it("keeps defaults and exact path overrides when Git identity is unavailable", () => {
    expect(lifecycleConfig().pre_commit).toEqual(["review", "custom"]);
    expect(lifecycleConfig(join(root, "missing")).pre_commit).toEqual(["review", "custom"]);
    saveConfig({ lifecycle: { repos: { [root]: { pre_commit: [] } } } });
    expect(lifecycleConfig(root).pre_commit).toEqual([]);
  });
});

it("separate metadata shares devloop state across checkouts", async () => {
  const { stateDirectory } = await import("../domain/context/store.js");
  expect(stateDirectory(repo)).toBe(join(repo, ".devloop"));
  const metadata = join(root, "metadata");
  git(repo, "init", "--separate-git-dir", metadata);
  const linked = join(root, "linked");
  git(repo, "worktree", "add", "-qb", "linked", linked);
  expect(stateDirectory(repo)).toBe(join(metadata, ".devloop"));
  expect(stateDirectory(linked)).toBe(stateDirectory(repo));
  const name = "中文 file.py ";
  writeFileSync(join(repo, name), "pass\n");
  git(repo, "add", "--", name);
  git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "unicode");
});

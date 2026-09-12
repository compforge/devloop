import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { architectureConfig, lifecycleConfig, saveConfig } from "../lib/config.js";
import { runGit } from "../lib/process.js";

let root: string;
let repo: string;

function git(cwd: string, ...args: string[]): void {
  const result = runGit(cwd, ["-c", "core.hooksPath=/dev/null", ...args]);
  if (!result.ok) throw new Error(result.stderr);
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-config-")));
  repo = join(root, "repo");
  mkdirSync(repo);
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-qm", "init");
  saveConfig({
    lifecycle: { default: { pre_commit: ["lint", "test"], post_mr: ["review"] }, repos: { [repo]: { pre_commit: [] } } },
    arch: { repos: { [repo]: { enabled: true, layers: { "/domain/": "domain" } } } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("repository policy inheritance", () => {
  it.each(["nested", "external"])("inherits the main repository policy in a %s worktree", (location) => {
    const checkout = location === "nested" ? join(repo, ".worktrees", "fix") : join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    expect(lifecycleConfig(checkout)).toEqual(lifecycleConfig(repo));
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: [], post_mr: ["review"] });
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
    expect(lifecycleConfig(checkout)).toMatchObject({ pre_commit: ["test"], post_mr: ["review"] });
    expect(lifecycleConfig(repo).pre_commit).toEqual([]);
    expect(architectureConfig(checkout)).toMatchObject({ enabled: false, layers: { "/domain/": "domain" } });
  });

  it("does not inherit a parent repository policy into a submodule", () => {
    const source = join(root, "source");
    git(root, "clone", "-q", repo, source);
    git(repo, "-c", "protocol.file.allow=always", "submodule", "add", "-q", source, "child");
    expect(lifecycleConfig(join(repo, "child")).pre_commit).toEqual(["lint", "test"]);
  });

  it("resolves worktrees of repositories with a separate git directory", () => {
    git(repo, "init", "-q", "--separate-git-dir", join(root, "metadata"));
    git(repo, "config", "core.worktree", repo);
    const checkout = join(root, "external");
    git(repo, "worktree", "add", "-qb", "fix", checkout);
    expect(lifecycleConfig(checkout).pre_commit).toEqual([]);
  });

  it("keeps defaults and exact path overrides when Git identity is unavailable", () => {
    expect(lifecycleConfig().pre_commit).toEqual(["lint", "test"]);
    expect(lifecycleConfig(join(root, "missing")).pre_commit).toEqual(["lint", "test"]);
    saveConfig({ lifecycle: { repos: { [root]: { pre_commit: [] } } } });
    expect(lifecycleConfig(root).pre_commit).toEqual([]);
  });
});

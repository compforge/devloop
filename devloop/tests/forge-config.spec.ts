import { afterEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ForgeConnection } from "@compforge/repokit";
import { prContextForRepo } from "../lib/forge.js";

const reader = vi.spyOn(ForgeConnection.prototype, "reader");
const roots: string[] = [];
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it("takes access from RepoKit and only proposal policy from devloop", async () => {
  const root = mkdtempSync(join(tmpdir(), "devloop-forge-config-")); roots.push(root);
  const home = join(root,"repokit"); mkdirSync(home);
  writeFileSync(join(home,"config.json"),JSON.stringify({forges:{"git.example.com":{provider:"gitlab",token:"fixture",apiHost:"api.example.com"}}}),{mode:0o600});
  vi.stubEnv("REPOKIT_HOME",home);
  vi.stubEnv("GITLAB_TOKEN","ignored");
  vi.stubEnv("DEVLOOP_CONFIG_DIR",join(root,"workflow"));
  execFileSync("git", ["init", root]);
  execFileSync("git", ["-C", root, "remote", "add", "origin", "https://git.example.com/owner/repo.git"]);
  mkdirSync(join(root,".devloop"));
  writeFileSync(join(root,".devloop/config.json"),JSON.stringify({pull_request:{target_repository:"upstream/repo"}}));
  const context = await prContextForRepo(root);
  try {
    expect(reader).toHaveBeenCalledOnce();
    expect(reader.mock.contexts[0]).toMatchObject({host:"git.example.com",provider:"gitlab",apiHost:"api.example.com"});
    expect(context?.options.targets[0]?.path).toBe("upstream/repo");
  } finally { context?.close(); }
});

it("distinguishes absent origin from unavailable RepoKit configuration at the gate", async () => {
  const { evaluateGate } = await import("../domain/context/gate.js");
  const root = mkdtempSync(join(tmpdir(), "devloop-forge-missing-")); roots.push(root);
  vi.stubEnv("REPOKIT_HOME",join(root,"repokit"));
  vi.stubEnv("GH_TOKEN","ignored");
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args]);
  git("init", "-b", "feature"); git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "initial");
  expect((await evaluateGate(root)).activePullRequest).toBeUndefined();
  git("remote", "add", "origin", "https://github.com/example/repo.git");
  await expect(evaluateGate(root)).rejects.toThrow("no github credential for github.com");
  expect(reader).not.toHaveBeenCalled();
});

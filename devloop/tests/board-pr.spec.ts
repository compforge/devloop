import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PullRequestContext } from "@compforge/repokit";
import { prContextForRepo } from "../lib/forge.js";
import { userPromptOutput } from "../adapters/process-hooks.js";

vi.mock("../lib/forge.js", () => ({ prContextForRepo: vi.fn() }));
let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-board-pr-")));
  vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
  execFileSync("git", ["init", "-q", "-b", "feature", root]);
  execFileSync("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "initial"]);
});
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); rmSync(root, { recursive: true, force: true }); });

// @case A slow Forge query is cancelled within the Board budget and other prompt context is delivered.
it("cancels a stalled native PR query without losing the rest of the prompt", async () => {
  const repository = { forge: { name: "github" }, path: "owner/repo" };
  const reader = { forge: "github", provider: "github",
    listPullRequests: async (): Promise<{ items: [] }> => new Promise(() => {}),
    getPullRequest: async (): Promise<never> => { throw new Error("unexpected PR read"); } };
  const context = new PullRequestContext(reader, { checkout: root, source: repository, targets: [repository], home: join(root, "state"), connection: "test" });
  const query = vi.spyOn(context, "getCheckout"), close = vi.spyOn(context, "close");
  vi.mocked(prContextForRepo).mockResolvedValue(context);
  const output = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "slow-forge" }));
  expect(query.mock.calls[0]?.[0]?.signal?.aborted).toBe(true);
  expect(output).toContain("PR status unavailable");
  expect(output).toContain("[Current repo:");
  expect(close).toHaveBeenCalledOnce();
});

it("shows missing credentials as unavailable while delivering other context", async () => {
  vi.mocked(prContextForRepo).mockRejectedValue(new Error("PR query unavailable: no credential"));
  const output = JSON.stringify(await userPromptOutput({ cwd: root, session_id: "no-credential" }));
  expect(output).toContain("no credential");
  expect(output).toContain("[Current repo:");
});

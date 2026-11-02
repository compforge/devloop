import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForgeReader } from "@compforge/repokit";
import { forgeEntry, forgeToken } from "../lib/config.js";
import { prContextForRepo } from "../lib/forge.js";

vi.mock("../lib/config.js", () => ({ forgeEntry: vi.fn(), forgeToken: vi.fn() }));
vi.mock("@compforge/repokit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@compforge/repokit")>();
  return { ...actual, createForgeReader: vi.fn(actual.createForgeReader) };
});
const roots: string[] = [];
afterEach(() => { vi.clearAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it.each([
  { entry: {}, host: "gitlab.example.com", target: "owner/repo" },
  { entry: { api_host: "", target_repository: "" }, host: "gitlab.example.com", target: "owner/repo" },
  { entry: { api_host: "api.example.com", target_repository: "upstream/repo" }, host: "api.example.com", target: "upstream/repo" },
])("normalizes Forge configuration before constructing queries: $entry", async ({ entry, host, target }) => {
  const root = mkdtempSync(join(tmpdir(), "devloop-forge-config-")); roots.push(root);
  execFileSync("git", ["init", root]);
  execFileSync("git", ["-C", root, "remote", "add", "origin", "https://gitlab.example.com/owner/repo.git"]);
  vi.mocked(forgeEntry).mockReturnValue({ type: "gitlab", ...entry });
  vi.mocked(forgeToken).mockReturnValue("test-credential");
  const context = await prContextForRepo(root);
  try {
    expect(createForgeReader).toHaveBeenCalledWith({ forge: "gitlab.example.com", provider: "gitlab", host, token: "test-credential" });
    expect(context?.options.targets[0]?.path).toBe(target);
    expect(context?.options.connection).toBe(createHash("sha256").update(JSON.stringify(["gitlab", "gitlab.example.com", host, "test-credential"])).digest("hex"));
  } finally { context?.close(); }
});

it("distinguishes an absent Forge origin from unavailable credentials at the gate", async () => {
  const { evaluateGate } = await import("../domain/context/gate.js");
  const root = mkdtempSync(join(tmpdir(), "devloop-forge-missing-")); roots.push(root);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args]);
  git("init", "-b", "feature"); git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "initial");
  expect((await evaluateGate(root)).activePullRequest).toBeUndefined();
  git("remote", "add", "origin", "https://github.com/example/repo.git");
  vi.mocked(forgeEntry).mockReturnValue({});
  vi.mocked(forgeToken).mockReturnValue(undefined);
  await expect(evaluateGate(root)).rejects.toThrow("no credential for github.com/example/repo");
  expect(createForgeReader).not.toHaveBeenCalled();
});

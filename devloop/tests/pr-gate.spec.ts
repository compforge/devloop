import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PullRequestContext, type PullRequestSnapshot } from "@compforge/repokit";
import { prContextForRepo } from "../lib/forge.js";
import { evaluateGate } from "../domain/context/gate.js";

vi.mock("../lib/forge.js", () => ({ prContextForRepo: vi.fn() }));
const roots: string[] = [];
afterEach(() => { vi.resetAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "devloop-pr-gate-")); roots.push(root);
  const git = (...args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "-b", "feature"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.com"); git("commit", "--allow-empty", "-m", "initial");
  const repository = { forge: { name: "github" }, path: "owner/repo" };
  const rows: PullRequestSnapshot[] = [{ repository, number: 1, state: "merged", sourceRepository: repository, sourceBranch: "feature", headSha: git("rev-parse", "HEAD") }];
  const reader = { forge: "github", provider: "github", listPullRequests: async () => ({ items: rows.map(({ repository, number }) => ({ repository, number })) }),
    getPullRequest: async (key: { number: number }) => rows.find(row => row.number === key.number)! };
  const context = new PullRequestContext(reader, { checkout: root, source: repository, targets: [repository], home: join(root, "state"), connection: "test" });
  vi.mocked(prContextForRepo).mockResolvedValue(context);
  return { root, reader, rows, git };
}
describe("PR decision queries", () => {
  it("consumes native observations without a devloop PR snapshot", async () => {
    const f = fixture(); expect((await evaluateGate(f.root)).inactive).toBe(true);
  });
  it("an unavailable PR cannot authorize a gate", async () => {
    const f = fixture(); f.reader.getPullRequest = async () => { throw new Error("offline"); };
    await expect(evaluateGate(f.root)).rejects.toThrow("offline");
  });
  it("a checkout change during a query invalidates the decision", async () => {
    const f = fixture();
    f.reader.getPullRequest = async () => { f.git("switch", "-c", "other"); return f.rows[0]!; };
    await expect(evaluateGate(f.root)).rejects.toThrow("Checkout changed");
  });
});

it("rejects two open PRs but accepts a verified empty association", async () => {
  const ambiguous = fixture();
  ambiguous.rows[0] = { ...ambiguous.rows[0]!, state: "open" };
  ambiguous.rows.push({ ...ambiguous.rows[0]!, number: 2 });
  await expect(evaluateGate(ambiguous.root)).rejects.toThrow("Multiple PRs match");
  const absent = fixture(); absent.rows.splice(0);
  expect((await evaluateGate(absent.root)).activePullRequest).toBeUndefined();
});

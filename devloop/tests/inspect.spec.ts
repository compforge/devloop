import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as toolkit from "@compforge/repocli";
import { inspectCatalog } from "../domain/repo-layout.js";
import { selectComponents } from "../domain/repo.js";
import { PolicyContext } from "../hooks/core/context.js";
import { evaluate } from "../hooks/core/engine.js";
import { InspectionError } from "../lib/repocli.js";
import { endSession } from "../adapters/process-hooks.js";
import { acquireOwner, anyActiveOwner } from "../domain/context/session.js";
import type { Rule } from "../hooks/core/rule.js";

vi.mock("@compforge/repocli", { spy: true });

const roots: string[] = [];
afterEach(() => { vi.mocked(toolkit.inspect).mockClear(); vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-inspect-"))); roots.push(root);
  execFileSync("git", ["init", "-q", root]);
  mkdirSync(join(root, "service"));
  writeFileSync(join(root, "service/go.mod"), "module example.com/service\n");
  const components = [{ root: ".", name: "workspace" }, { root: "service", name: "api", language: "go" }, { root: "client", name: "web" }];
  const write = (value: unknown) => writeFileSync(join(root, ".repocli.json"), JSON.stringify(value));
  write({ components });
  // Native inspection must not depend on a usable repocli executable.
  vi.stubEnv("DEVLOOP_REPOCLI", join(root, "missing-cli"));
  return { root, components, write };
}

describe("native repocli organization", () => {
  it("uses declared roots and metadata for moved, deleted and fixture paths without a CLI", async () => {
    const { root } = fixture();
    mkdirSync(join(root, "service/testdata/corpus"), { recursive: true });
    writeFileSync(join(root, "service/testdata/corpus/go.mod"), "module corpus");
    const catalog = await inspectCatalog(root);
    expect(selectComponents(root, { paths: ["service/old.go", "client/new.ts", "service/testdata/corpus/go.mod"], catalog }).components.map((c) => c.id)).toEqual(["service", "client"]);
    expect(catalog.owner(join(root, "service/deleted.go"))).toMatchObject({ id: "service", name: "api", language: "go", packageTools: [{ name: "go", evidence: ["service/go.mod"] }] });
    expect(catalog.owner(join(root, "service2/other.go"))?.id).toBe(".");
    expect(catalog.owner(join(root, "../outside"))).toBeUndefined();
  });

  it("shares in-flight work and failures within an operation, then refreshes", async () => {
    const { root, components, write } = fixture();
    const calls = vi.mocked(toolkit.inspect);
    const identity = { sessionId: "test", harness: "codex" } as const;
    const context = new PolicyContext(root, identity);
    const first = context.catalog(root);
    const sibling = context.forTarget({ kind: "file_change", path: join(root, "a.go"), mode: "edit" }).catalog(root);
    expect(sibling).toBe(first);
    await Promise.all([first, sibling]);
    expect(calls).toHaveBeenCalledTimes(1);
    write({ components: [{ root: "../escape", name: "bad" }] });
    expect(context.catalog(root)).toBe(first);
    const failed = new PolicyContext(root, identity);
    const rejection = failed.catalog(root);
    await expect(rejection).rejects.toThrow(InspectionError);
    write({ components });
    expect(failed.catalog(root)).toBe(rejection);
    await expect(failed.catalog(root)).rejects.toThrow(InspectionError);
    expect((await new PolicyContext(root, identity).catalog(root)).components).toHaveLength(3);
    expect(calls).toHaveBeenCalledTimes(3);
  });

  it.each([
    [{ root: "../escape", name: "bad" }],
    [{ root: ".", name: "x" }, { root: ".", name: "y" }],
  ])("rejects invalid configured organization %j", async (...components) => {
    const { root, write } = fixture(); write({ components });
    await expect(inspectCatalog(root)).rejects.toThrow(InspectionError);
  });

  it("retains execution containment for roots below external symlinks", async () => {
    const { root, write } = fixture();
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "devloop-outside-"))); roots.push(outside);
    symlinkSync(outside, join(root, "linked"));
    write({ components: [{ root: "linked/missing", name: "external" }] });
    await expect(inspectCatalog(root)).rejects.toThrow("component root escapes checkout");
  });

  it("does not use a partial observation as a complete catalog", async () => {
    const { root } = fixture();
    const report = await toolkit.inspect({ repository: root });
    vi.mocked(toolkit.inspect).mockResolvedValueOnce({ ...report, complete: false, diagnostics: [{ code: "changed", message: "input changed" }] });
    await expect(inspectCatalog(root)).rejects.toThrow("inspection incomplete");
  });

  it("releases session ownership without starting inspection", () => {
    const { root } = fixture();
    vi.stubEnv("DEVLOOP_CONFIG_DIR", join(root, "config"));
    const identity = { sessionId: "cleanup", harness: "codex" } as const;
    expect(acquireOwner(root, identity, "feature")).toBe(true);
    expect(anyActiveOwner(root)).toBeDefined();
    endSession({ cwd: root, session_id: identity.sessionId }, identity.harness);
    expect(anyActiveOwner(root)).toBeUndefined();
    expect(toolkit.inspect).not.toHaveBeenCalled();
  });

  it("denies a gate with missing organization and warns for optional policies", async () => {
    const { root, write } = fixture(); write({ components: [{ root: "../escape", name: "bad" }] });
    const context = new PolicyContext(root, { sessionId: "test", harness: "codex" });
    const change = { cwd: root, tool: "edit", command: "", targets: [{ kind: "file_change" as const, path: join(root, "a.go"), mode: "edit" as const }] };
    const rule: Rule = { name: "inspection", targetKind: "file_change", applies: () => true, check: async (_target, ctx) => { await ctx.catalog(root); return []; } };
    expect((await evaluate(change, context, [rule])).action).toBe("warn");
    expect((await evaluate(change, context, [{ ...rule, failurePolicy: "fail_closed" }])).action).toBe("deny");
  });
});

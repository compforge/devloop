import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectCatalog } from "../domain/repo-layout.js";
import { selectComponents } from "../domain/repo.js";
import { PolicyContext } from "../hooks/core/context.js";
import { evaluate } from "../hooks/core/engine.js";
import { InspectionError } from "../lib/repocli.js";
import type { Rule } from "../hooks/core/rule.js";

const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "devloop-inspect-"))); roots.push(root);
  const cli = join(root, "repocli");
  const components = [{ root: ".", name: "workspace" }, { root: "service", name: "api", language: "go", packageTools: [{ name: "go", evidence: ["service/go.mod"] }] }, { root: "client", name: "web" }];
  const report = { schemaVersion: 1, checkout: root, input: "working_tree", complete: true, diagnostics: [], components };
  const write = (value: unknown) => writeFileSync(cli, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(JSON.stringify(value))});\n`, { mode: 0o755 });
  write(report); vi.stubEnv("DEVLOOP_REPOCLI", cli);
  return { root, report, write };
}

describe("repocli organization", () => {
  it("uses declared roots and metadata for moved, deleted and fixture paths", () => {
    const { root } = fixture();
    mkdirSync(join(root, "service/testdata/corpus"), { recursive: true });
    writeFileSync(join(root, "service/testdata/corpus/go.mod"), "module corpus");
    const catalog = inspectCatalog(root);
    expect(selectComponents(root, { paths: ["service/old.go", "client/new.ts", "service/testdata/corpus/go.mod"], catalog }).components.map((c) => c.id)).toEqual(["service", "client"]);
    expect(catalog.owner(join(root, "service/deleted.go"))).toMatchObject({ id: "service", name: "api", language: "go", packageTools: [{ name: "go", version: "", evidence: ["service/go.mod"] }] });
    expect(catalog.owner(join(root, "service2/other.go"))?.id).toBe(".");
    expect(catalog.owner(join(root, "../outside"))).toBeUndefined();
  });

  it("shares one catalog within a policy operation and refreshes on the next", () => {
    const { root, report, write } = fixture();
    const identity = { sessionId: "test", harness: "codex" } as const;
    const context = new PolicyContext(root, identity);
    const first = context.catalog(root);
    write({ ...report, complete: false });
    expect(context.forTarget({ kind: "file_change", path: join(root, "a.go"), mode: "edit" }).catalog(root)).toBe(first);
    expect(() => new PolicyContext(root, identity).catalog(root)).toThrow(InspectionError);
    const failed = new PolicyContext(root, identity);
    expect(() => failed.catalog(root)).toThrow(InspectionError);
    write(report);
    expect(() => failed.catalog(root)).toThrow(InspectionError);
    expect(new PolicyContext(root, identity).catalog(root).components).toHaveLength(3);
  });

  it.each([
    { schemaVersion: 2 }, { complete: false }, { input: "commit" }, { checkout: "/elsewhere" },
    { components: [{ root: "../escape", name: "bad" }] },
    { components: [{ root: ".", name: "x" }, { root: ".", name: "y" }] },
  ])("rejects invalid inspection %j", (patch) => {
    const { root, report, write } = fixture(); write({ ...report, ...patch });
    expect(() => inspectCatalog(root)).toThrow(InspectionError);
  });

  it("denies a gate with missing organization and warns for optional policies", () => {
    const { root, report, write } = fixture(); write({ ...report, complete: false });
    const context = new PolicyContext(root, { sessionId: "test", harness: "codex" });
    const change = { cwd: root, tool: "edit", command: "", targets: [{ kind: "file_change" as const, path: join(root, "a.go"), mode: "edit" as const }] };
    const rule: Rule = { name: "inspection", targetKind: "file_change", applies: () => true, check: (_target, ctx) => { ctx.catalog(root); return []; } };
    expect(evaluate(change, context, [rule]).action).toBe("warn");
    expect(evaluate(change, context, [{ ...rule, failurePolicy: "fail_closed" }]).action).toBe("deny");
  });
});

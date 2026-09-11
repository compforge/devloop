import { describe, expect, it } from "vitest";
import type { PolicyContext } from "../hooks/core/context.js";
import type { FileChangeTarget } from "../hooks/core/domain.js";
import { RULES } from "../hooks/rules/index.js";

describe("policy rules", () => {
  it("enforces configured TypeScript layer direction", () => {
    const rule = RULES.find((candidate) => candidate.name === "layer-deps")!;
    const target: FileChangeTarget = {
      kind: "file_change", path: "/repo/dao/user.ts", mode: "write",
      toolInput: { content: 'import { User } from "../service/user.js";\nexport const value = User;' },
    };
    const context = {
      architecture: { enabled: true, layers: { "/service/": "service", "/dao/": "dao" }, order: ["service", "dao"] },
    } as unknown as PolicyContext;
    expect(rule.applies(target, context)).toBe(true);
    expect(rule.check(target, context)).toMatchObject([{ rule: "layer-deps", severity: "deny" }]);
  });
});

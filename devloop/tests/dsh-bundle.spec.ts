import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageRoot = new URL("../", import.meta.url);

describe("DSH bundle package", () => {
  it("ships an auto-activating Cordis layer", () => {
    const manifest = JSON.parse(readFileSync(new URL("package.json", packageRoot), "utf8")) as {
      readonly dsh?: { readonly bundle?: { readonly patch?: string } };
      readonly files?: readonly string[];
    };
    const patchPath = manifest.dsh?.bundle?.patch;

    expect(patchPath).toBe("./cordis.patch.yml");
    expect(manifest.files).toContain("cordis.patch.yml");
    const patch = readFileSync(new URL(patchPath!, packageRoot), "utf8");

    expect(patch).toContain("id: devloop-skills");
    expect(patch).toContain("name: '@deepseek-ai/dsh-skill-filesystem'");
    expect(patch).toContain("providerName: devloop");
    expect(patch).toContain("includeDefaultRoots: false");
    expect(patch).toContain("watch: false");
    expect(patch).toContain("bundledSkillDir:");
    expect(patch).toContain("createRequire(baseUrl)");
    expect(patch).toContain(".resolve('@compforge/devloop/cordis.patch.yml')");
    expect(patch).toContain("id: devloop-runtime");
    expect(patch).toContain("name: './dist/adapters/dsh.js'");
  });
});

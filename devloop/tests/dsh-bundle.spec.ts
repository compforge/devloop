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
    expect(readFileSync(new URL(patchPath!, packageRoot), "utf8"))
      .toContain("name: '@compforge/devloop/dsh'");
  });
});

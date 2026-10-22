import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// Explicit opt-in keeps the ordinary suite independent of an installed coding CLI.
it.skipIf(!process.env.DEVLOOP_OPENCODE_BIN)("runs the installed OpenCode V2 host with a local scripted model", async () => {
  const result = await promisify(execFile)(process.execPath, [fileURLToPath(new URL("fixtures/opencode-host.mjs", import.meta.url))], {
    timeout: 90_000, maxBuffer: 1024 * 1024,
  });
  expect(result.stdout).toContain('"protectedCommitDenied":true');
  expect(result.stdout).toContain('"pythonIdentity":true');
}, 95_000);

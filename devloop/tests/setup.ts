import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

// SDK defaults persist observations; tests must never write to the user home.
const home = mkdtempSync(join(tmpdir(), "devloop-repokit-test-"));
const previousHome = process.env.REPOKIT_HOME;
const previousConfig = process.env.DEVLOOP_CONFIG_DIR;
process.env.DEVLOOP_CONFIG_DIR = join(home, "devloop");
process.env.REPOKIT_HOME = home;
afterAll(() => {
  if (previousHome === undefined) delete process.env.REPOKIT_HOME;
  else process.env.REPOKIT_HOME = previousHome;
  if (previousConfig === undefined) delete process.env.DEVLOOP_CONFIG_DIR;
  else process.env.DEVLOOP_CONFIG_DIR = previousConfig;
  rmSync(home, { recursive: true, force: true });
});

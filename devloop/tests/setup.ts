import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

// SDK defaults persist observations; tests must never write to the user home.
const home = mkdtempSync(join(tmpdir(), "devloop-repokit-test-"));
const previousHome = process.env.REPOKIT_HOME;
process.env.REPOKIT_HOME = home;
afterAll(() => {
  if (previousHome === undefined) delete process.env.REPOKIT_HOME;
  else process.env.REPOKIT_HOME = previousHome;
  rmSync(home, { recursive: true, force: true });
});

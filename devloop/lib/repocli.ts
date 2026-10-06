import { inspect, type InspectReport } from "@compforge/repocli";
import { realpathSync, existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";

export class InspectionError extends Error {}

/** Repository organization comes from the toolkit; execution containment is devloop policy. */
export async function inspectRepository(repo: string): Promise<InspectReport> {
  try {
    const report = await inspect({ repository: repo, timeoutMs: 5_000 });
    if (!report.complete || report.diagnostics.length > 0) throw new Error("repository inspection incomplete");
    const checkout = realpathSync(repo);
    for (const component of report.components) {
      let ancestor = join(checkout, component.root);
      // A declared root can be absent; its existing parent must still belong to this checkout.
      while (!existsSync(ancestor)) ancestor = dirname(ancestor);
      const resolved = realpathSync(ancestor);
      if (resolved !== checkout && !resolved.startsWith(checkout + sep)) throw new Error("component root escapes checkout");
    }
    return report;
  } catch (error) {
    throw new InspectionError(`repository inspection unavailable: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

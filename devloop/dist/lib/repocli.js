import { realpathSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, posix, sep } from "node:path";
import { runCommand } from "./process.js";
export class InspectionError extends Error {
}
function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** A bounded protocol adapter, not a second repository scanner. */
export function inspectRepository(repo) {
    try {
        const result = runCommand(process.env.DEVLOOP_REPOCLI ?? "repocli", ["inspect", "--repo", repo, "--json", "--timeout", "5s"], { cwd: repo, timeoutMs: 10_000 });
        if (!result.ok)
            throw new Error(`inspect exited ${result.code}: ${result.stderr.slice(-2000)}`);
        const data = JSON.parse(result.stdout);
        if (!record(data) || data.schemaVersion !== 1)
            throw new Error("unsupported inspect schema (requires 1)");
        if (data.input !== "working_tree" || typeof data.checkout !== "string" || realpathSync(data.checkout) !== realpathSync(repo))
            throw new Error("inspect target mismatch");
        if (data.complete !== true || !Array.isArray(data.diagnostics) || data.diagnostics.length !== 0)
            throw new Error("repository inspection incomplete");
        if (!Array.isArray(data.components))
            throw new Error("inspect components missing");
        const roots = new Set(), names = new Set();
        return data.components.map((entry) => {
            if (!record(entry))
                throw new Error("invalid component entry");
            const { root, name, language } = entry;
            if (typeof root !== "string" || !root || root.includes("\\") || root.includes("\0") || isAbsolute(root) || root.split("/").includes("..") || posix.normalize(root) !== root || roots.has(root)
                || typeof name !== "string" || !name || names.has(name) || language !== undefined && typeof language !== "string")
                throw new Error("invalid component identity or root");
            const checkout = realpathSync(repo);
            let ancestor = join(checkout, root);
            // A declared root can be absent; its existing parent must still belong to this checkout.
            while (!existsSync(ancestor))
                ancestor = dirname(ancestor);
            const resolved = realpathSync(ancestor);
            if (resolved !== checkout && !resolved.startsWith(checkout + sep))
                throw new Error("component root escapes checkout");
            const rawTools = entry.packageTools ?? [];
            if (!Array.isArray(rawTools))
                throw new Error("invalid package tools");
            const packageTools = rawTools.map((tool) => {
                if (!record(tool) || typeof tool.name !== "string" || tool.version !== undefined && typeof tool.version !== "string"
                    || tool.evidence !== undefined && (!Array.isArray(tool.evidence) || tool.evidence.some((x) => typeof x !== "string")))
                    throw new Error("invalid package tool evidence");
                return { name: tool.name, version: tool.version ?? "", evidence: tool.evidence ?? [] };
            });
            roots.add(root);
            names.add(name);
            return { root, name, language: language, packageTools };
        });
    }
    catch (error) {
        throw new InspectionError(`repocli inspect unavailable: ${error instanceof Error ? error.message : String(error)}; install repocli >= 0.11.0`);
    }
}
//# sourceMappingURL=repocli.js.map
import { dirname, isAbsolute, resolve } from "node:path";
import { architectureConfig } from "../../lib/config.js";
import { findGitRoot, inspectCatalog } from "../../domain/repo-layout.js";
/** Read-only facts exposed to policy rules. */
export class PolicyContext {
    inspections;
    cwd;
    identity;
    anchorPath;
    anchorDirectory;
    constructor(cwd, identity, anchorPath = "", inspections = new Map()) {
        this.inspections = inspections;
        this.cwd = cwd;
        this.identity = identity;
        this.anchorPath = anchorPath ? (isAbsolute(anchorPath) ? anchorPath : resolve(cwd, anchorPath)) : "";
        this.anchorDirectory = this.anchorPath ? dirname(this.anchorPath) : cwd;
    }
    forTarget(target) {
        if (target.kind === "file_change")
            return new PolicyContext(this.cwd, this.identity, target.path, this.inspections);
        return target.workingDirectory.path ? new PolicyContext(target.workingDirectory.path, this.identity, "", this.inspections) : this;
    }
    catalog(repo) {
        const key = resolve(repo);
        if (!this.inspections.has(key)) {
            try {
                this.inspections.set(key, inspectCatalog(key));
            }
            catch (error) {
                this.inspections.set(key, error instanceof Error ? error : new Error(String(error)));
            }
        }
        const value = this.inspections.get(key);
        if (value instanceof Error)
            throw value;
        return value;
    }
    get sessionId() { return this.identity.sessionId; }
    get harness() { return this.identity.harness; }
    get gitRoot() { return this.anchorDirectory ? findGitRoot(this.anchorDirectory) : undefined; }
    get architecture() { return architectureConfig(this.gitRoot); }
}
//# sourceMappingURL=context.js.map
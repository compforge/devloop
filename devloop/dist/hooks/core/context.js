import { dirname, isAbsolute, resolve } from "node:path";
import { architectureConfig } from "../../lib/config.js";
import { findGitRoot } from "../../domain/repo-layout.js";
/** Read-only facts exposed to policy rules. */
export class PolicyContext {
    cwd;
    identity;
    anchorPath;
    anchorDirectory;
    constructor(cwd, identity, anchorPath = "") {
        this.cwd = cwd;
        this.identity = identity;
        this.anchorPath = anchorPath ? (isAbsolute(anchorPath) ? anchorPath : resolve(cwd, anchorPath)) : "";
        this.anchorDirectory = this.anchorPath ? dirname(this.anchorPath) : cwd;
    }
    forTarget(target) {
        if (target.kind === "file_change")
            return new PolicyContext(this.cwd, this.identity, target.path);
        return target.workingDirectory.path ? new PolicyContext(target.workingDirectory.path, this.identity) : this;
    }
    get sessionId() { return this.identity.sessionId; }
    get harness() { return this.identity.harness; }
    get gitRoot() { return this.anchorDirectory ? findGitRoot(this.anchorDirectory) : undefined; }
    get architecture() { return architectureConfig(this.gitRoot); }
}
//# sourceMappingURL=context.js.map
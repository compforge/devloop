import { dirname, isAbsolute, resolve } from "node:path";
import { architectureConfig, type JsonObject } from "../../lib/config.js";
import { findGitRoot } from "../../domain/repo-layout.js";
import type { SessionIdentity } from "../../domain/context/session.js";
import type { Target } from "./domain.js";

/** Read-only facts exposed to policy rules. */
export class PolicyContext {
  readonly cwd: string;
  readonly identity: SessionIdentity;
  readonly anchorPath: string;
  readonly anchorDirectory: string;

  constructor(cwd: string, identity: SessionIdentity, anchorPath = "") {
    this.cwd = cwd;
    this.identity = identity;
    this.anchorPath = anchorPath ? (isAbsolute(anchorPath) ? anchorPath : resolve(cwd, anchorPath)) : "";
    this.anchorDirectory = this.anchorPath ? dirname(this.anchorPath) : cwd;
  }

  forTarget(target: Target): PolicyContext {
    if (target.kind === "file_change") return new PolicyContext(this.cwd, this.identity, target.path);
    return target.workingDirectory.path ? new PolicyContext(target.workingDirectory.path, this.identity) : this;
  }

  get sessionId(): string { return this.identity.sessionId; }
  get harness(): string { return this.identity.harness; }
  get gitRoot(): string | undefined { return this.anchorDirectory ? findGitRoot(this.anchorDirectory) : undefined; }
  get architecture(): JsonObject { return architectureConfig(this.gitRoot); }
}

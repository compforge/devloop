import { type JsonObject } from "../../lib/config.js";
import type { SessionIdentity } from "../../domain/context/session.js";
import type { Target } from "./domain.js";
/** Read-only facts exposed to policy rules. */
export declare class PolicyContext {
    readonly cwd: string;
    readonly identity: SessionIdentity;
    readonly anchorPath: string;
    readonly anchorDirectory: string;
    constructor(cwd: string, identity: SessionIdentity, anchorPath?: string);
    forTarget(target: Target): PolicyContext;
    get sessionId(): string;
    get harness(): string;
    get gitRoot(): string | undefined;
    get architecture(): JsonObject;
}
//# sourceMappingURL=context.d.ts.map
import { type JsonObject } from "../../lib/config.js";
import { type ComponentCatalog } from "../../domain/repo-layout.js";
import type { SessionIdentity } from "../../domain/context/session.js";
import type { Target } from "./domain.js";
/** Read-only facts exposed to policy rules. */
export declare class PolicyContext {
    private readonly inspections;
    readonly cwd: string;
    readonly identity: SessionIdentity;
    readonly anchorPath: string;
    readonly anchorDirectory: string;
    constructor(cwd: string, identity: SessionIdentity, anchorPath?: string, inspections?: Map<string, Promise<ComponentCatalog>>);
    forTarget(target: Target): PolicyContext;
    catalog(repo: string): Promise<ComponentCatalog>;
    get sessionId(): string;
    get harness(): string;
    get gitRoot(): string | undefined;
    get architecture(): JsonObject;
}
//# sourceMappingURL=context.d.ts.map
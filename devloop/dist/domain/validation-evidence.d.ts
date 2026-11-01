import type { JsonObject } from "../lib/config.js";
export declare function evidenceSegment(repo: string, component: string, check: string): string;
/** Original CLI evidence, reconciled by the workflow to a branch. */
export declare function fullEvidence(repo: string, component: string, check: string, reference: unknown): JsonObject | undefined;
export declare function fullProjection(repo: string, branch: string | undefined, check: string): JsonObject;
/**
 * Guard the checked working tree and dependency receipts; repocli alone decides execution reuse.
 * @why The Harness process environment is not the frozen environment of a completed check.
 */
export declare function reusableFullEvidence(record: JsonObject | undefined, fingerprint: string | undefined): boolean;
/** Last observed check capability, for presentation only; absence means unknown. */
export declare function observedCheck(repo: string, component: string, check: string): JsonObject | undefined;
//# sourceMappingURL=validation-evidence.d.ts.map
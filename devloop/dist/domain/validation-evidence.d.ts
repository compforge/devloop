import type { JsonObject } from "../lib/config.js";
export declare function evidenceSegment(repo: string, component: string, check: string): string;
/** Resolve a branch reference; legacy stamps and replaced records cannot grant a pass. */
export declare function fullEvidence(repo: string, component: string, check: string, reference: unknown): JsonObject | undefined;
/** Historical projection only; eligibility also requires current contents and dependency witnesses. */
export declare function fullProjection(repo: string, branch: string | undefined, check: string): JsonObject;
export declare function reusableFullEvidence(record: JsonObject | undefined, fingerprint: string | undefined, command: readonly string[]): boolean;
export declare function environmentIdentity(values?: NodeJS.ProcessEnv): string;
//# sourceMappingURL=validation-evidence.d.ts.map
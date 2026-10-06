import { type Decision } from "./domain.js";
import { type HarnessToolInput } from "./project.js";
/** One harness-neutral entrypoint for every pre-tool adapter. */
export declare function evaluateTool(input: HarnessToolInput): Promise<Decision>;
export declare function deniedReason(input: HarnessToolInput): Promise<string | undefined>;
//# sourceMappingURL=policy.d.ts.map
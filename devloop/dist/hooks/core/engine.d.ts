import type { PolicyContext } from "./context.js";
import { type Change, type Decision } from "./domain.js";
import type { Rule } from "./rule.js";
/** Evaluate independent policy rules; rule bugs fail open unless explicitly declared otherwise. */
export declare function evaluate(change: Change, context: PolicyContext, rules: readonly Rule[]): Decision;
//# sourceMappingURL=engine.d.ts.map
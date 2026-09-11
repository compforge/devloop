import type { PolicyContext } from "./context.js";
import type { Change, Finding, Target, TargetKind } from "./domain.js";

export interface Rule {
  readonly name: string;
  readonly targetKind: TargetKind;
  readonly failurePolicy?: "fail_open" | "fail_closed";
  applies(target: Target | Change, context: PolicyContext): boolean;
  check(target: Target | Change, context: PolicyContext): readonly Finding[];
}

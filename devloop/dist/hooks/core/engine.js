import { decision } from "./domain.js";
/** Evaluate independent policy rules; rule bugs fail open unless explicitly declared otherwise. */
export function evaluate(change, context, rules) {
    const findings = [];
    for (const target of change.targets) {
        const targetContext = context.forTarget(target);
        for (const rule of rules.filter((candidate) => candidate.targetKind === target.kind)) {
            try {
                if (rule.applies(target, targetContext))
                    findings.push(...rule.check(target, targetContext));
            }
            catch {
                if (rule.failurePolicy === "fail_closed")
                    findings.push({ rule: rule.name, severity: "deny", message: `${rule.name}: policy evaluation failed (fail-closed)` });
            }
        }
    }
    for (const rule of rules.filter((candidate) => candidate.targetKind === "change")) {
        try {
            if (rule.applies(change, context))
                findings.push(...rule.check(change, context));
        }
        catch {
            if (rule.failurePolicy === "fail_closed")
                findings.push({ rule: rule.name, severity: "deny", message: `${rule.name}: policy evaluation failed (fail-closed)` });
        }
    }
    return decision(findings);
}
//# sourceMappingURL=engine.js.map
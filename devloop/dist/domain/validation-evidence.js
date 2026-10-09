import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { branchSegment, loadSegment } from "./context/store.js";
export function evidenceSegment(repo, component, check) {
    return "validation_results/" + createHash("sha256").update(`${realpathSync(repo)}\0${component}\0${check}`).digest("hex");
}
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
/** Resolve a branch reference; legacy stamps and replaced records cannot grant a pass. */
export function fullEvidence(repo, component, check, reference) {
    const ref = object(reference);
    const segment = evidenceSegment(repo, component, check);
    if (ref.evidence !== segment)
        return undefined;
    const record = loadSegment(repo, segment) ?? {};
    const identity = object(record.identity);
    if (record.status !== "passed" || identity.version !== 2 || identity.checkout !== realpathSync(repo)
        || identity.component !== component || identity.check !== check || identity.scope !== "full"
        || typeof identity.fingerprint !== "string" || !identity.fingerprint
        || typeof record.checked_at !== "number" || record.checked_at !== ref.checked_at)
        return undefined;
    return record;
}
/** Historical projection only; eligibility also requires current contents and dependency witnesses. */
export function fullProjection(repo, branch, check) {
    const refs = loadSegment(repo, branchSegment(branch, check)) ?? {};
    return Object.fromEntries(Object.entries(refs).flatMap(([component, reference]) => {
        const record = fullEvidence(repo, component, check, reference);
        return record ? [[component, { passed_at: record.checked_at ?? null, fingerprint: object(record.identity).fingerprint ?? null }]] : [];
    }));
}
export function reusableFullEvidence(record, fingerprint, command) {
    if (!record || !fingerprint)
        return false;
    const identity = object(record.identity);
    const environmentHash = environmentIdentity();
    if (identity.environment !== environmentHash || identity.fingerprint !== fingerprint || JSON.stringify(identity.command) !== JSON.stringify(command)
        || !Array.isArray(identity.dependencies))
        return false;
    // Native Python preparation owns the receipt. The runtime only reads its witnesses;
    // it never launches a workflow or reclassifies package managers.
    try {
        return identity.dependencies.every((input) => Array.isArray(input) && input.length === 2
            && typeof input[0] === "string" && typeof input[1] === "string"
            && createHash("sha256").update(readFileSync(input[0])).digest("hex") === input[1]);
    }
    catch {
        return false;
    }
}
export function environmentIdentity(values = process.env) {
    const pairs = Object.entries(values).filter(([key, value]) => value !== undefined
        && !["_", "SHLVL", "PWD", "OLDPWD"].includes(key))
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return createHash("sha256").update(JSON.stringify(pairs)).digest("hex");
}
//# sourceMappingURL=validation-evidence.js.map
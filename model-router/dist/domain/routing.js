export const COMPLEXITIES = ["simple", "medium", "complex"];
/** @spec Uncertain simple classifications cannot downgrade a task below the medium route. */
export function routeFor(answer, minimumConfidence) {
    return answer.complexity === "simple" && answer.confidence < minimumConfidence ? "medium" : answer.complexity;
}
export function sameModel(left, right) {
    return !!left && !!right && left.providerID === right.providerID && left.id === right.id
        && (left.variant ?? "default") === (right.variant ?? "default");
}
/** @spec Stored routing ownership is accepted only when it contains a complete model reference. */
export function modelRef(value) {
    if (!value || typeof value !== "object")
        return undefined;
    const ref = value;
    if (typeof ref.providerID !== "string" || !ref.providerID || typeof ref.id !== "string" || !ref.id)
        return undefined;
    if (ref.variant !== undefined && (typeof ref.variant !== "string" || !ref.variant))
        return undefined;
    return { providerID: ref.providerID, id: ref.id, ...(typeof ref.variant === "string" ? { variant: ref.variant } : {}) };
}

export const PRS_CAP = 5;
export class ForgeError extends Error {
}
export class ForgeAuthError extends ForgeError {
}
export class ForgeNotFound extends ForgeError {
}
export function blocksMerge(readiness) {
    return readiness === "conflict" || readiness === "discussions_unresolved" || readiness === "ci_blocked";
}
export function pullRequestInactive(pr) {
    return pr.state === "merged" || pr.state === "closed";
}
export function pullRequestOpen(pr) {
    return pr.state === "open";
}
export function vocabulary(provider) {
    return provider === "gitlab" ? ["MR", "!"] : ["PR", "#"];
}
export function pullRequestLabel(provider, number) {
    const [noun, sigil] = vocabulary(provider);
    return `${noun} ${sigil}${number}`;
}
export function parsePullRequestNumber(value) {
    const match = value.match(/\/(?:pull|merge_requests)\/(\d+)/) ?? value.trim().match(/^[!#]?(\d+)$/);
    return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}
/** Keep the current proposal in the bounded recent window. */
export async function buildWindow(forge, anchor, cap = PRS_CAP) {
    const byNumber = new Map((await forge.recent(cap)).map((pr) => [pr.number, pr]));
    if (anchor !== undefined && !byNumber.has(anchor)) {
        try {
            const current = await forge.get(anchor);
            byNumber.set(current.number, current);
        }
        catch (error) {
            if (!(error instanceof ForgeNotFound))
                throw error;
        }
    }
    let ordered = [...byNumber.values()].sort((left, right) => right.number - left.number);
    if (anchor !== undefined && byNumber.has(anchor) && !ordered.slice(0, cap).some((pr) => pr.number === anchor)) {
        ordered = [...ordered.filter((pr) => pr.number !== anchor).slice(0, Math.max(0, cap - 1)), byNumber.get(anchor)]
            .sort((left, right) => right.number - left.number);
    }
    return ordered.slice(0, cap);
}
//# sourceMappingURL=forge.js.map
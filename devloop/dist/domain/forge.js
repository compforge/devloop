export { ForgeError, ForgeAuthError, ForgeNotFound, parsePullRequestNumber } from "@compforge/repocli";
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
//# sourceMappingURL=forge.js.map
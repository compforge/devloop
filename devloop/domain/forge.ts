export { ForgeError, ForgeAuthError, ForgeNotFound, parsePullRequestNumber } from "@compforge/repokit";
export type { PullRequestKey, PullRequestState, PullRequestSnapshot } from "@compforge/repokit";
import type { PullRequestSnapshot, PullRequestMergeReadiness } from "@compforge/repokit";
export function blocksMerge(readiness: PullRequestMergeReadiness): boolean {
  return readiness === "conflict" || readiness === "discussions_unresolved" || readiness === "ci_blocked";
}

export function pullRequestInactive(pr: PullRequestSnapshot): boolean {
  return pr.state === "merged" || pr.state === "closed";
}

export function pullRequestOpen(pr: PullRequestSnapshot): boolean {
  return pr.state === "open";
}

export function vocabulary(provider?: string): readonly [noun: string, sigil: string] {
  return provider === "gitlab" ? ["MR", "!"] : ["PR", "#"];
}

export function pullRequestLabel(provider: string | undefined, number: number): string {
  const [noun, sigil] = vocabulary(provider);
  return `${noun} ${sigil}${number}`;
}

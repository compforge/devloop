export const PRS_CAP = 5;

export class ForgeError extends Error {}
export class ForgeAuthError extends ForgeError {}
export class ForgeNotFound extends ForgeError {}

/** Stable cross-repository identity of a review proposal. */
export interface PullRequestIdentity {
  readonly source: string;
  readonly repository: string;
  readonly number: number;
}

export type PullRequestState = "open" | "merged" | "closed" | "";

/** Provider-neutral code review proposal. */
export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly state: PullRequestState;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly webUrl: string;
  readonly sha: string;
  readonly updatedAt?: string;
}

export type CommentResolution = "unsupported" | "unresolved" | "resolved";

/** Provider-neutral conversation or review thread. */
export interface Comment {
  readonly author: string;
  readonly body: string;
  readonly id: string;
  readonly path: string;
  readonly line?: number;
  readonly createdAt: string;
  readonly replies: readonly Comment[];
  readonly replyRef: string;
  readonly resolveRef: string;
  readonly resolution: CommentResolution;
}

export interface Release {
  readonly tag: string;
  readonly name: string;
  readonly target: string;
  readonly webUrl: string;
  readonly createdAt?: string;
}

export type MergeReadiness =
  | "ready"
  | "conflict"
  | "discussions_unresolved"
  | "ci_blocked"
  | "needs_approval"
  | "draft"
  | "unknown";

export function blocksMerge(readiness: MergeReadiness): boolean {
  return readiness === "conflict" || readiness === "discussions_unresolved" || readiness === "ci_blocked";
}

export function pullRequestInactive(pr: PullRequest): boolean {
  return pr.state === "merged" || pr.state === "closed";
}

export function pullRequestOpen(pr: PullRequest): boolean {
  return pr.state === "open";
}

export function vocabulary(provider?: string): readonly [noun: string, sigil: string] {
  return provider === "gitlab" ? ["MR", "!"] : ["PR", "#"];
}

export function pullRequestLabel(provider: string | undefined, number: number): string {
  const [noun, sigil] = vocabulary(provider);
  return `${noun} ${sigil}${number}`;
}

export function parsePullRequestNumber(value: string): number | undefined {
  const match = value.match(/\/(?:pull|merge_requests)\/(\d+)/) ?? value.trim().match(/^[!#]?(\d+)$/);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

/** Forge primitives consumed by workflows; provider policy stays outside adapters. */
export interface ForgePort {
  readonly provider: "github" | "gitlab";
  create(input: { readonly sourceBranch: string; readonly targetBranch: string; readonly title: string; readonly body?: string }): Promise<PullRequest>;
  get(number: number): Promise<PullRequest>;
  description(number: number): Promise<string>;
  update(number: number, fields: { readonly title?: string; readonly body?: string; readonly targetBranch?: string }): Promise<PullRequest>;
  close(number: number): Promise<PullRequest>;
  pullRequestsForBranch(branch: string): Promise<readonly PullRequest[]>;
  recent(limit: number): Promise<readonly PullRequest[]>;
  defaultBranch(): Promise<string>;
  createRelease(input: { readonly tag: string; readonly target: string; readonly name?: string; readonly notes?: string }): Promise<Release>;
  latestRelease(): Promise<Release | undefined>;
  comments(number: number): Promise<readonly Comment[]>;
  comment(number: number, body: string, options?: { readonly replyable?: boolean; readonly path?: string; readonly line?: number }): Promise<void>;
  reply(number: number, target: Comment, body: string): Promise<void>;
  resolveComment(number: number, target: Comment): Promise<void>;
  mergeReadiness(number: number): Promise<MergeReadiness>;
}

/** Keep the current proposal in the bounded recent window. */
export async function buildWindow(forge: ForgePort, anchor?: number, cap = PRS_CAP): Promise<readonly PullRequest[]> {
  const byNumber = new Map((await forge.recent(cap)).map((pr) => [pr.number, pr]));
  if (anchor !== undefined && !byNumber.has(anchor)) {
    try {
      const current = await forge.get(anchor);
      byNumber.set(current.number, current);
    } catch (error) {
      if (!(error instanceof ForgeNotFound)) throw error;
    }
  }
  let ordered = [...byNumber.values()].sort((left, right) => right.number - left.number);
  if (anchor !== undefined && byNumber.has(anchor) && !ordered.slice(0, cap).some((pr) => pr.number === anchor)) {
    ordered = [...ordered.filter((pr) => pr.number !== anchor).slice(0, Math.max(0, cap - 1)), byNumber.get(anchor)!]
      .sort((left, right) => right.number - left.number);
  }
  return ordered.slice(0, cap);
}

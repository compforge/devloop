import { basename, dirname, isAbsolute, resolve } from "node:path";
import { findGitRoot, findAgentsDocument } from "../domain/repo-layout.js";
import { WorkspaceContext } from "../domain/context/workspace.js";
import { acquireOwner, clearActiveRepo, recordActiveRepo, releaseOwner, type SessionIdentity } from "../domain/context/session.js";
import { appendToolCall, TOOL_CALL_SCHEMA, toolCallStartedAt } from "../domain/context/tool-calls.js";
import { findContainingWorkspace, maybeRegisterWorkspace } from "../domain/workspace.js";
import { BoardRuntime } from "../domain/board/runtime.js";
import { projectBoard } from "../domain/board/projection.js";
import { currentBranch, listWorktrees } from "../lib/git-state.js";
import { projectTool } from "../hooks/core/project.js";
import type { HookHarness, HookPayload } from "./hook-payload.js";

export type RuntimeHarness = HookHarness | "dsh";

function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function cwd(payload: HookPayload): string { return string(payload.cwd) || process.cwd(); }
function sessionId(payload: HookPayload): string { return string(payload.session_id); }
function identity(payload: HookPayload, harness: RuntimeHarness): SessionIdentity { return { harness, sessionId: sessionId(payload) }; }

/** Refresh discoverable workspace facts and construct the shared Board for session startup. */
export function initializeBoard(payload: HookPayload): { readonly runtime?: BoardRuntime; readonly watchPaths: readonly string[] } {
  const directory = cwd(payload);
  const workspaceRoot = findContainingWorkspace(directory) ?? maybeRegisterWorkspace(directory);
  const workspace = workspaceRoot ? WorkspaceContext.refresh(workspaceRoot) : undefined;
  const repo = findGitRoot(directory);
  const root = workspaceRoot ?? repo;
  if (!root) return { watchPaths: [] };
  const board = projectBoard(root, workspace, repo);
  const runtime = new BoardRuntime(root, sessionId(payload), board, board.view({ workspaceRoot: root, ...(repo ? { repoRoot: repo } : {}) }), repo);
  const watchPaths = new Set<string>();
  if (workspace?.agentsDocument.path) watchPaths.add(workspace.agentsDocument.path);
  for (const project of workspace?.subprojects ?? []) {
    const agents = findAgentsDocument(project.path);
    if (agents) watchPaths.add(agents);
  }
  if (repo) {
    const agents = findAgentsDocument(repo);
    if (agents) watchPaths.add(agents);
  }
  return { runtime, watchPaths: [...watchPaths] };
}

export function sessionStartOutput(payload: HookPayload, harness: HookHarness = "claude"): Record<string, unknown> {
  const { runtime, watchPaths } = initializeBoard(payload);
  const content = runtime?.deliverPrompt("session_start");
  const deliveredWatches = harness === "claude" ? watchPaths : [];
  if (!content && deliveredWatches.length === 0) return {};
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      ...(content ? { additionalContext: content } : {}),
      ...(deliveredWatches.length ? { watchPaths: deliveredWatches } : {}),
    },
  };
}

export function userPromptOutput(payload: HookPayload): Record<string, unknown> {
  const content = BoardRuntime.resolve(cwd(payload), sessionId(payload))?.deliverPrompt("user_prompt");
  return content ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: content } } : {};
}

export function afterCompact(payload: HookPayload): void {
  BoardRuntime.resolve(cwd(payload), sessionId(payload))?.afterCompact();
}

export function afterCwdChanged(payload: HookPayload): void {
  const directory = string((payload as Record<string, unknown>).new_cwd) || cwd(payload);
  const repo = findGitRoot(directory); const workspace = findContainingWorkspace(directory);
  if (repo && workspace) recordActiveRepo(workspace, repo, sessionId(payload));
}

const STATE_SUBCOMMANDS = new Set(["commit", "push", "checkout", "switch", "reset", "merge", "rebase", "pull", "fetch"]);
export function afterTool(payload: HookPayload, harness: RuntimeHarness): void {
  const input = payload.tool_input;
  const toolInput = input !== null && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : { input: string(input) };
  if (sessionId(payload)) toolInput.session_id = sessionId(payload);
  const change = projectTool({ harness, toolName: string(payload.tool_name), toolInput, cwd: cwd(payload) });
  for (const target of change.targets) {
    if (target.kind !== "command" || !target.subcommand || !STATE_SUBCOMMANDS.has(target.subcommand) || !target.workingDirectory.path) continue;
    const repo = findGitRoot(target.workingDirectory.path); if (!repo) continue;
    const workspace = findContainingWorkspace(repo); if (workspace) recordActiveRepo(workspace, repo, sessionId(payload));
    if (target.subcommand !== "fetch") acquireOwner(repo, identity(payload, harness), currentBranch(repo) ?? "");
  }
}

export function afterFileChanged(payload: HookPayload): void {
  const path = string((payload as Record<string, unknown>).file_path);
  if (basename(path) !== "AGENTS.md") return;
  const workspace = findContainingWorkspace(path);
  if (workspace) WorkspaceContext.refresh(workspace);
}

/** Record tool timing in the same TypeScript process that evaluates hook policy. */
export function recordToolCall(payload: HookPayload, harness: RuntimeHarness): void {
  const event = string(payload.hook_event_name);
  if (!["PreToolUse", "PostToolUse", "PostToolUseFailure"].includes(event)) return;
  const rawInput = payload.tool_input;
  const toolInput = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput)
    ? rawInput as Record<string, unknown> : { input: String(rawInput ?? "") };
  const directory = cwd(payload);
  const change = projectTool({ harness, toolName: string(payload.tool_name), toolInput, cwd: directory });
  const anchors: string[] = [];
  for (const target of change.targets) {
    if (target.kind === "file_change") {
      const path = isAbsolute(target.path) ? target.path : resolve(directory, target.path);
      anchors.push(dirname(path));
    } else if (target.workingDirectory.path) anchors.push(target.workingDirectory.path);
  }
  for (const key of ["file_path", "notebook_path", "path"]) {
    const value = toolInput[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const path = isAbsolute(value) ? value : resolve(directory, value);
    anchors.push(dirname(path));
  }
  if (anchors.length === 0) anchors.push(directory);
  const timestamp = Date.now() / 1_000;
  const callId = string(payload.tool_use_id);
  const phase = event === "PreToolUse" ? "started" : "finished";
  for (const root of new Set(anchors.flatMap((anchor) => findGitRoot(anchor) ?? []))) {
    const record: Record<string, string | number> = {
      schema: TOOL_CALL_SCHEMA, kind: "tool_call", phase, ts: timestamp, call_id: callId,
      session_id: sessionId(payload), harness, tool: string(payload.tool_name),
    };
    if (phase === "finished") {
      record.outcome = event === "PostToolUseFailure" ? "failed" : "succeeded";
      const started = toolCallStartedAt(root, callId, timestamp);
      if (started !== undefined) record.duration_ms = Math.max(0, Math.round((timestamp - started) * 1_000));
    }
    appendToolCall(root, record, timestamp);
  }
}

export function endSession(payload: HookPayload, harness: RuntimeHarness): void {
  const runtime = BoardRuntime.resolve(cwd(payload), sessionId(payload));
  runtime?.close();
  const workspace = findContainingWorkspace(cwd(payload));
  if (workspace) clearActiveRepo(workspace, sessionId(payload));
  const candidates = new Set<string>();
  const direct = findGitRoot(cwd(payload)); if (direct) candidates.add(direct);
  const workspaceContext = workspace ? WorkspaceContext.load(workspace) ?? WorkspaceContext.refresh(workspace) : undefined;
  for (const project of workspaceContext?.subprojects ?? []) {
    const repo = findGitRoot(project.path); if (repo) candidates.add(repo);
  }
  for (const repo of [...candidates]) for (const worktree of listWorktrees(repo)) candidates.add(worktree.path);
  for (const repo of candidates) releaseOwner(repo, identity(payload, harness));
}

import { aheadBehind, currentBranch, isProtectedBranch, localDefaultTarget, workspaceStatus, checkoutInfo } from "../../lib/git-state.js";
import { findAgentsDocument, defaultComponent, type Component } from "../repo-layout.js";
import { InspectionError } from "../../lib/repocli.js";
import { parseReferencesSection } from "../../lib/parsers.js";
import { branchSegment, loadSegment, segmentFile } from "../context/store.js";
import { REVIEW_STALE_SECONDS, now } from "../context/base.js";
import type { WorkspaceContext } from "../context/workspace.js";
import { Board, boardItem } from "./model.js";

export async function projectBoard(root: string, workspace?: WorkspaceContext, repo?: string, staleBindingHours?: number): Promise<Board> {
  const items = [];
  if (workspace && (workspace.agentsDocument.references.length > 0 || workspace.subprojects.length > 0)) {
    items.push(boardItem("workspace", "state", { workspaceRoot: root }, {
      root: workspace.workspaceRoot,
      references: workspace.agentsDocument.references.map((item) => ({ title: item.title, path: item.path, description: item.hook ?? "" })),
      subprojects: workspace.subprojects.map((item) => ({
        name: item.name, aliases: item.aliases, language: item.language ?? "", role: item.role ?? "", canonical: item.canonical ?? "",
      })),
    }));
  }
  if (!repo) return new Board(root, items);
  const scope = { workspaceRoot: root, repoRoot: repo };
  let component: Component | undefined, inspectionProblem = "";
  try { component = await defaultComponent(repo); }
  catch (error) {
    if (!(error instanceof InspectionError)) throw error;
    inspectionProblem = error.message;
  }
  const agents = findAgentsDocument(repo, component?.path);
  const references = agents ? parseReferencesSection(agents) : [];
  if (references.length > 0) {
    items.push(boardItem("repo.references", "state", scope, {
      references: references.map((item) => ({ title: item.title, path: item.path, description: item.description })),
    }));
  }
  const branch = currentBranch(repo) ?? "";
  const base = localDefaultTarget(repo);
  const [ahead, behind] = aheadBehind(repo, base) ?? [0, 0];
  const status = workspaceStatus(repo);
  const codeDir = component?.path ?? "";
  let linkedWorktree: boolean | null;
  try { linkedWorktree = checkoutInfo(repo).linked; } catch { linkedWorktree = null; }
  items.push(boardItem("repo.identity", "state", scope, {
    codeDir, repoRoot: repo, language: component?.language ?? "", inspectionProblem, branch,
    linkedWorktree, ahead, behind, baseBranch: base,
    targetBranch: base, workspaceDirty: status.complete ? status.dirty : null, modifiedCount: status.modifiedCount,
    untrackedCount: status.untrackedCount, protected: isProtectedBranch(branch),
    ...(staleBindingHours === undefined ? {} : { staleBindingHours }),
  }));
  const lint = loadSegment(repo, branchSegment(branch || undefined, "lint")) ?? {};
  const test = loadSegment(repo, branchSegment(branch || undefined, "test")) ?? {};
  const componentIds = [...new Set([...Object.keys(lint), ...Object.keys(test)])].sort();
  items.push(boardItem("repo.validation", "state", scope, {
    analysis: loadSegment(repo, branchSegment(branch || undefined, "validation_scope")) ?? {},
    components: componentIds.map((component) => ({
      component,
      lintAt: typeof lint[component] === "object" && lint[component] !== null && !Array.isArray(lint[component]) ? (lint[component] as Record<string, unknown>).passed_at ?? null : null,
      testAt: typeof test[component] === "object" && test[component] !== null && !Array.isArray(test[component]) ? (test[component] as Record<string, unknown>).passed_at ?? null : null,
    })),
  }));
  const reviewSegment = branchSegment(branch || undefined, "review");
  const review = loadSegment(repo, reviewSegment);
  if (review && typeof review.status === "string" && review.status && review.status !== "skipped"
      && typeof review.reviewed_sha === "string" && review.reviewed_sha) {
    const generatedAt = typeof review.generated_at === "number" ? review.generated_at : 0;
    const reviewStatus = review.status === "running" && now() - generatedAt > REVIEW_STALE_SECONDS ? "stale" : review.status;
    // Review is branch-owned persisted state. Keep delivery receipts out of its
    // projection so prompt and UI observe the same result, including failures.
    items.push(boardItem("repo.review", "event", scope, {
      status: reviewStatus, reviewedSha: review.reviewed_sha,
      findings: typeof review.count === "number" ? review.count : 0,
      failedFiles: typeof review.failed === "number" ? review.failed : 0,
      message: typeof review.message === "string" ? review.message : "",
      artifactPath: segmentFile(repo, reviewSegment),
    }));
  }
  return new Board(root, items);
}

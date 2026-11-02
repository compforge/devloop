import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { branchSegment, loadSegment } from "./context/store.js";
import type { JsonObject } from "../lib/config.js";

export function evidenceSegment(repo: string, component: string, check: string): string {
  return "validation_results/" + createHash("sha256").update(`${realpathSync(repo)}\0${component}\0${check}`).digest("hex");
}

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

/** Original CLI evidence, reconciled by the workflow to a branch. */
export function fullEvidence(repo: string, component: string, check: string, reference: unknown): JsonObject | undefined {
  const ref = object(reference);
  const segment = evidenceSegment(repo, component, check);
  if (ref.evidence !== segment) return undefined;
  const record = loadSegment(repo, segment) ?? {};
  const report = object(record.report);
  if (record.eligible !== true || report.schemaVersion !== 1 || report.inputsConsistent !== true
      || report.checkout !== realpathSync(repo) || typeof report.snapshot !== "string" || !report.snapshot
      || typeof record.checked_at !== "string" || record.checked_at !== ref.checked_at) return undefined;
  for (const raw of Array.isArray(report.components) ? report.components : []) {
    const group = object(raw);
    for (const rawCheck of Array.isArray(group.checks) ? group.checks : []) {
      const result = object(rawCheck);
      if (object(group.component).root !== component && !(Array.isArray(result.requestedComponents) && result.requestedComponents.includes(component))) continue;
      if (result.check === check && result.scope === "full" && result.status === "passed" && result.checkedAt === record.checked_at) return record;
    }
  }
  return undefined;
}

export function fullProjection(repo: string, branch: string | undefined, check: string): JsonObject {
  const refs = loadSegment(repo, branchSegment(branch, check)) ?? {};
  return Object.fromEntries(Object.entries(refs).flatMap(([component, reference]) => {
    const record = fullEvidence(repo, component, check, reference);
    return record ? [[component, { passed_at: Date.parse(String(record.checked_at)) / 1000, fingerprint: object(record.report).snapshot ?? null }]] : [];
  }));
}

/**
 * Guard the checked working tree and dependency receipts; repocli alone decides execution reuse.
 * @why The Harness process environment is not the frozen environment of a completed check.
 */
export function reusableFullEvidence(record: JsonObject | undefined, fingerprint: string | undefined): boolean {
  if (!record || !fingerprint) return false;
  const report = object(record.report);
  if (report.snapshot !== fingerprint) return false;
  try {
    return (Array.isArray(report.components) ? report.components : []).every((raw) => {
      const group = object(raw);
      return (Array.isArray(group.checks) ? group.checks : []).every((rawCheck) => {
        const check = object(rawCheck);
        if (object(check.inputs).disableReuse === true) return false;
        return Object.entries(object(check.witnesses)).every(([path, digest]) =>
          createHash("sha256").update(readFileSync(path)).digest("hex") === digest);
      });
    });
  } catch { return false; }
}

/** Last observed check capability, for presentation only; absence means unknown. */
export function observedCheck(repo: string, component: string, check: string): JsonObject | undefined {
  const report = object((loadSegment(repo, evidenceSegment(repo, component, check)) ?? {}).report);
  if (report.schemaVersion !== 1 || report.checkout !== realpathSync(repo)) return undefined;
  for (const raw of Array.isArray(report.components) ? report.components : []) {
    const group = object(raw);
    for (const rawCheck of Array.isArray(group.checks) ? group.checks : []) {
      const result = object(rawCheck);
      if (object(group.component).root !== component && !(Array.isArray(result.requestedComponents) && result.requestedComponents.includes(component))) continue;
      if (result.check === check) return result;
    }
  }
  return undefined;
}

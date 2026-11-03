"""Branch references to original repocli check reports; never reimplement reuse."""
from __future__ import annotations

import hashlib
from datetime import datetime
from pathlib import Path

from domain.context.store import branch_segment, load_segment, save_segment
from lib import git_state


def evidence_segment(repo: str, component: str, check: str) -> str:
    owner = f"{Path(repo).resolve()}\0{component}\0{check}"
    return "validation_results/" + hashlib.sha256(owner.encode()).hexdigest()


def full_evidence(repo: str, component: str, check: str, reference: dict) -> dict | None:
    segment = evidence_segment(repo, component, check)
    if reference.get("evidence") != segment:
        return None
    record = load_segment(repo, segment) or {}
    report = record.get("report", {})
    if (not record.get("eligible") or report.get("schemaVersion") != 2
            or not report.get("inputsConsistent") or report.get("checkout") != str(Path(repo).resolve())
            or not report.get("snapshot") or record.get("checked_at") != reference.get("checked_at")):
        return None
    for group in report.get("components", []):
        for result in group["checks"]:
            if group["component"]["root"] == component or component in result.get("requestedComponents", []):
                if (result["check"] == check and result["scope"] == "full" and result["status"] == "passed"
                        and result["checkedAt"] == record.get("checked_at")):
                    return record
    return None


def bind_full(repo: str, components: list[str], check: str) -> None:
    segment = branch_segment(git_state.get_current_branch(repo), check)
    references = load_segment(repo, segment) or {}
    for component in components:
        evidence = evidence_segment(repo, component, check)
        record = load_segment(repo, evidence) or {}
        reference = {"evidence": evidence, "checked_at": record.get("checked_at")}
        if full_evidence(repo, component, check, reference):
            references[component] = reference
    save_segment(repo, segment, references)


def full_projection(repo: str, branch: str | None, check: str) -> dict:
    references = load_segment(repo, branch_segment(branch, check)) or {}
    result = {}
    for component, reference in references.items():
        if isinstance(reference, dict) and (record := full_evidence(repo, component, check, reference)):
            result[component] = {"passed_at": datetime.fromisoformat(record["checked_at"].replace("Z", "+00:00")).timestamp(),
                                 "fingerprint": record["report"]["snapshot"]}
    return result

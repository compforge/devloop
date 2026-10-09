"""Read full-check evidence and maintain branch references to the original run."""
from __future__ import annotations

import hashlib
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
    identity = record.get("identity") or {}
    if not isinstance(identity, dict):
        return None
    if (record.get("status") != "passed" or identity.get("version") != 2
            or identity.get("checkout") != str(Path(repo).resolve())
            or identity.get("component") != component or identity.get("check") != check
            or identity.get("scope") != "full" or not identity.get("fingerprint")
            or not isinstance(record.get("checked_at"), (int, float))
            or record.get("checked_at") != reference.get("checked_at")):
        return None
    return record


def bind_full(repo: str, components: list[str], check: str) -> None:
    """Called by the check coordinator after workers join, including successful reuse."""
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
            result[component] = {"passed_at": record["checked_at"],
                                 "fingerprint": record["identity"]["fingerprint"]}
    return result

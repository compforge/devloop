"""Check input boundaries and content identities, independent of affected-file selection."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import subprocess

from repocli import SnapshotScope, component_scopes, snapshot
from domain.repo_layout import Catalog
from lib import config


@dataclass(frozen=True)
class CheckInputs:
    fingerprint: str
    reason: str
    components: tuple[str, ...] = ()


def input_policy(repo: str) -> str:
    """Capture effective policy even when its source is ignored or outside the checkout."""
    return json.dumps(config.load(repo).get("validation", {}), sort_keys=True, separators=(",", ":"))


def check_inputs(repo: str, catalog: Catalog, checks: tuple[tuple[str, str], ...],
                 execution_identity: str, policy: str) -> dict[tuple[str, str], CheckInputs]:
    """Declared inputs authorize component reuse; unknown boundaries retain repository reuse.

    +spec=`Input fingerprints never choose or widen affected-file execution scope`
    +spec=`Declarations include the complete transitive component and shared-file inputs of a check`
    +why=`A Component directory or a partial static graph does not prove a Make target's dependencies`
    +link=component://docs/repository-toolkit.md
    """
    results = {key: CheckInputs(execution_identity, "repository inputs: no complete check declaration")
               for key in checks}
    section = json.loads(policy)
    declarations = section.get("inputs", {}) if isinstance(section, dict) else None
    if not isinstance(declarations, dict):
        return {key: CheckInputs(execution_identity, "repository inputs: invalid validation.inputs")
                for key in checks}
    owned = component_scopes(catalog.report)
    scopes: dict[str, SnapshotScope] = {}
    declared: dict[tuple[str, str], tuple[tuple[str, ...], tuple[str, ...]]] = {}
    for component, check in checks:
        key = component, check
        entry = declarations.get(component, {})
        if not isinstance(entry, dict) or check not in entry:
            continue
        entry = entry[check]
        try:
            if not isinstance(entry, dict) or set(entry) != {"components", "paths"}:
                raise ValueError("expected complete components and paths lists")
            for field in ("components", "paths"):
                if not isinstance(entry[field], list) or any(not isinstance(x, str) for x in entry[field]):
                    raise ValueError(f"{field} must be a list of paths")
            components = tuple(sorted(set((component, *entry["components"]))))
            names = []
            for dependency in components:
                if dependency not in owned:
                    raise ValueError(f"unknown Component {dependency!r}")
                name = "component:" + dependency
                scopes[name] = owned[dependency]
                names.append(name)
            for path in sorted(set(entry["paths"])):
                name = "path:" + path
                scopes[name] = SnapshotScope((path,))
                names.append(name)
            declared[key] = components, tuple(sorted(names))
        except ValueError as exc:
            results[key] = CheckInputs(execution_identity, f"repository inputs: {exc}")
    if not declared:
        return results
    try:
        observed = snapshot(repo, scopes=scopes)
        if not observed.complete or observed.digest != execution_identity:
            raise ValueError("content capture differs from validation plan")
        captured = {item.name: item for item in observed.scopes}
        for key, (components, names) in declared.items():
            gaps = [issue for name in names for issue in captured[name].diagnostics]
            if gaps:
                results[key] = CheckInputs(execution_identity, "repository inputs: " + "; ".join(gaps))
                continue
            payload = [(name, captured[name].digest) for name in names]
            digest = hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()
            results[key] = CheckInputs("check-inputs-v1:" + digest,
                                       "declared Component inputs: " + ", ".join(names), components)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        for key in declared:
            results[key] = CheckInputs("", f"input identity unavailable: {exc}")
    return results

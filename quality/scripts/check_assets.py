"""Validate shipped quality assets without running a model or a target project."""
from __future__ import annotations

import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


def check(root: Path) -> list[str]:
    errors: list[str] = []
    manifests = [json.loads((root / kind / "plugin.json").read_text())
                 for kind in (".claude-plugin", ".codex-plugin")]
    if any(item["name"] != "quality" for item in manifests):
        errors.append("plugin name must be quality")
    if manifests[0]["version"] != manifests[1]["version"]:
        errors.append("plugin versions differ")
    skills = sorted((root / "skills").glob("*/SKILL.md"))
    if not skills:
        errors.append("no skills found")
    for skill in skills:
        text = skill.read_text()
        match = re.match(r"\A---\n(.*?)\n---(?:\n|$)", text, re.DOTALL)
        header = match.group(1) if match else ""
        if not re.search(rf"^name: {re.escape(skill.parent.name)}$", header, re.MULTILINE):
            errors.append(f"{skill.relative_to(root)}: name must match directory")
        if not re.search(r"^description: \S", header, re.MULTILINE):
            errors.append(f"{skill.relative_to(root)}: missing description")
        agent = skill.parent / "agents/openai.yaml"
        if not agent.is_file() or not re.search(r"^  default_prompt: .+", agent.read_text(), re.MULTILINE):
            errors.append(f"{skill.relative_to(root)}: missing agent prompt")
    for document in root.rglob("*.md"):
        # Check relative documentation links, excluding examples inside fenced code.
        text = re.sub(r"```.*?```", "", document.read_text(), flags=re.DOTALL)
        for target in re.findall(r"\[[^]\n]*\]\(([^)\s]+)\)", text):
            url = urlsplit(target)
            if url.scheme or url.netloc or not url.path or url.path.startswith("/"):
                continue
            path = document.parent / unquote(url.path)
            if not path.exists():
                errors.append(f"{document.relative_to(root)}: missing link {target}")
    return errors


if __name__ == "__main__":
    failures = check(Path(__file__).resolve().parents[1])
    for failure in failures:
        print(failure)
    raise SystemExit(bool(failures))

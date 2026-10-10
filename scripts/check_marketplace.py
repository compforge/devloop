"""Check the marketplace indexes owned by the repository root."""
import json
from pathlib import Path


def check(root: Path) -> list[str]:
    errors: list[str] = []
    catalogs: list[set[str]] = []
    for directory in (".claude-plugin", ".agents/plugins"):
        entries = json.loads((root / directory / "marketplace.json").read_text())["plugins"]
        names = [entry["name"] for entry in entries]
        if len(names) != len(set(names)):
            errors.append(f"{directory}: duplicate plugins")
        catalogs.append(set(names))
        for entry in entries:
            source = entry["source"]
            path = source if isinstance(source, str) else source["path"]
            kind = ".claude-plugin" if directory == ".claude-plugin" else ".codex-plugin"
            manifest = root / path / kind / "plugin.json"
            if not manifest.is_file():
                errors.append(f"{directory}: missing manifest for {entry['name']}")
            elif json.loads(manifest.read_text())["name"] != entry["name"]:
                errors.append(f"{directory}: mismatched plugin name {entry['name']}")
    if catalogs[0] != catalogs[1]:
        errors.append("Claude and Codex plugin indexes differ")
    return errors


if __name__ == "__main__":
    failures = check(Path(__file__).resolve().parents[1])
    for failure in failures:
        print(failure)
    raise SystemExit(bool(failures))

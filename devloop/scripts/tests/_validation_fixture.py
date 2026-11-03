"""Repository and external ValidationReport fixtures; no validation engine."""
from pathlib import Path
from _testkit import _git
from domain.validation_evidence import full_projection
from lib.git_state import get_current_branch
from domain.validation import content_identity

def make_repo(root: str, *, contract: bool = True) -> Path:
    repo = Path(root).resolve()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.name", "Test")
    _git(repo, "config", "user.email", "test@example.com")
    (repo / "pyproject.toml").write_text("[project]\nname = 'scope-fixture'\nversion = '0'\n")
    (repo / ".gitignore").write_text("*.observed\n.devloop/\n")
    (repo / "source.py").write_text("VALUE = 1\n")
    for name in ("test_a.py", "test_b.py"):
        (repo / name).write_text("OK\n")
    (repo / "check.py").write_text(
        "import sys\nfrom pathlib import Path\n"
        "Path('test.observed').write_text(' '.join(sys.argv[1:]))\n"
        "raise SystemExit(any(Path(name).read_text().strip() != 'OK' for name in sys.argv[1:]))\n"
    )
    selected = "$(if $(strip $(TEST_FILES)),$(TEST_FILES),test_a.py test_b.py)" if contract else "test_a.py test_b.py"
    (repo / "Makefile").write_text(f"SELECTED = {selected}\ntest:\n\t@python3 check.py $(SELECTED)\n")
    _git(repo, "add", "pyproject.toml", ".gitignore", "source.py", "test_a.py", "test_b.py", "check.py", "Makefile")
    _git(repo, "commit", "-qm", "baseline")
    return repo


def has_full_stamp(repo: Path) -> bool:
    return bool(full_projection(str(repo), get_current_branch(str(repo)), "test").get("."))



def report(repo, *, lint="passed", test="passed", consistent=True, scope="full"):
    checks = []
    for name, status in (("lint", lint), ("test", test)):
        checks.append({"check": name, "requestedComponents": ["."], "status": status, "scope": "unavailable" if status == "unavailable" else scope,
                       "command": ["make", "-f", "Makefile", name, "LINT_FILES=", "TEST_FILES="],
                       "files": [], "reason": "fixture", "reused": False, "reuseReason": "no previous check",
                       "checkedAt": "2026-11-01T12:00:00Z", "runID": "run-1", "requestedAt": "2026-11-01T12:00:00Z", "inputFiles": [],
                       "environment": "frozen-check-env", "witnesses": {}, "stdout": "", "stderr": ""})
    return {"schemaVersion": 2, "checkout": str(repo), "snapshot": content_identity(str(repo)).digest,
            "inputsConsistent": consistent, "complete": True, "passed": lint == test == "passed" and consistent,
            "components": [{"component": {"root": ".", "component": {"name": "."}}, "checks": checks}], "diagnostics": []}

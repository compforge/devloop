"""Isolated repository for native inspection and dependency tests."""
from pathlib import Path
from _testkit import _git

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


"""Real-index regression cases for commit scope and rejected staging."""
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

from _testkit import _git, _git_out, _load_script, run_main
from repocli.git_index import staged_changes
from repocli.git_state import git_path


@contextmanager
def repository():
    with TemporaryDirectory() as directory:
        root = Path(directory)
        _git(directory, "init", "-q")
        _git(directory, "config", "user.name", "Fixture")
        _git(directory, "config", "user.email", "fixture@example.invalid")
        _git(directory, "config", "core.hooksPath", "/dev/null")
        for name in ("a.py", "b.py"):
            (root / name).write_text("base\n")
        _git(directory, "add", "a.py", "b.py")
        _git(directory, "commit", "-qm", "base")
        yield root


def assert_rejected(root, files, text):
    flow = _load_script("commit_flow")
    index = git_path(root, "index")
    before = index.read_bytes()
    try:
        flow.stage(str(root), files, [])
    except flow.SmartError as exc:
        assert text in str(exc), str(exc)
    else:
        raise AssertionError("expected rejection")
    assert index.read_bytes() == before


def test_explicit_file_refuses_unrelated_partial_staging():
    with repository() as root:
        (root / "b.py").write_text("staged\n")
        _git(str(root), "add", "b.py")
        (root / "b.py").write_text("working\n")
        (root / "a.py").write_text("selected\n")
        assert_rejected(root, ["a.py"], "outside --file scope")
        assert _git_out(str(root), "show", ":b.py") == "staged"
        assert (root / "b.py").read_text() == "working\n"


def test_gitlink_rejection_preserves_prior_partial_staging():
    with repository() as root:
        (root / "a.py").write_text("staged\n")
        _git(str(root), "add", "a.py")
        (root / "a.py").write_text("working\n")
        nested = root / "nested"
        nested.mkdir()
        _git(str(nested), "init", "-q")
        _git(str(nested), "config", "user.name", "Fixture")
        _git(str(nested), "config", "user.email", "fixture@example.invalid")
        (nested / "source").write_text("source")
        _git(str(nested), "add", "source")
        _git(str(nested), "commit", "-qm", "nested")
        assert_rejected(root, [], "gitlink")
        assert _git_out(str(root), "show", ":a.py") == "staged"


def test_explicit_directory_filters_every_leaf_and_stages_deletion():
    flow = _load_script("commit_flow")
    with repository() as root:
        directory = root / "src"
        directory.mkdir()
        (directory / "gone.py").write_text("gone")
        _git(str(root), "add", "src/gone.py")
        _git(str(root), "commit", "-qm", "fixture")
        (directory / "gone.py").unlink()
        names = ["ok.py", " [a]\n中文.py ", "alias.py"]
        for name in names[:-1]:
            (directory / name).write_text("code")
        (directory / names[-1]).symlink_to("ok.py")
        (directory / ".env").write_text("secret")
        (directory / ".idea").mkdir()
        (directory / ".idea/config").write_text("private")
        (root / "a.py").write_text("unselected")
        flow.stage(str(root), ["src"], [])
        assert {c.path for c in staged_changes(root)} == {"src/gone.py", *("src/" + n for n in names)}
        _git(str(root), "commit", "-qm", "selected")
        assert _git_out(str(root), "show", "HEAD:a.py") == "base"
        assert _git_out(str(root), "status", "--porcelain", "--", "a.py")


def test_previously_staged_sensitive_file_blocks_without_reset():
    with repository() as root:
        (root / ".env").write_text("secret")
        _git(str(root), "add", ".env")
        (root / "a.py").write_text("changed")
        assert_rejected(root, [], "sensitive")


def test_staged_deletion_and_rename_are_not_readded():
    flow = _load_script("commit_flow")
    with repository() as root:
        _git(str(root), "rm", "a.py")
        _git(str(root), "mv", "b.py", "renamed.py")
        flow.stage(str(root), ["a.py", "b.py", "renamed.py"], [])
        assert {c.path for c in staged_changes(root)} == {"a.py", "b.py", "renamed.py"}


def test_rename_source_must_also_be_in_explicit_scope():
    with repository() as root:
        _git(str(root), "mv", "b.py", "renamed.py")
        assert_rejected(root, ["renamed.py"], "outside --file scope")


def test_gitlink_removal_is_allowed():
    flow = _load_script("commit_flow")
    with repository() as root:
        head = _git_out(str(root), "rev-parse", "HEAD")
        _git(str(root), "update-index", "--add", "--cacheinfo", f"160000,{head},nested")
        _git(str(root), "commit", "-qm", "old embedded repo")
        _git(str(root), "update-index", "--force-remove", "nested")
        flow.stage(str(root), ["nested"], [])
        assert staged_changes(root)[0].new_mode == "000000"


def test_explicit_glob_is_literal_and_absolute_symlink_keeps_identity():
    flow = _load_script("commit_flow")
    with repository() as root:
        (root / "[a].py").write_text("literal")
        (root / "a.py").write_text("unselected")
        (root / "link").symlink_to("a.py")
        files = flow.normalize_files(str(root), [str(root / "link"), "[a].py"], "/", [])
        assert files == ["link", "[a].py"]
        flow.stage(str(root), files, [])
        assert {c.path for c in staged_changes(root)} == {"link", "[a].py"}


def test_invalid_explicit_path_does_not_install_anything():
    with repository() as root:
        (root / "a.py").write_text("selected")
        assert_rejected(root, ["a.py", "missing"], "does not exist")
        assert_rejected(root, ["../outside"], "outside the repository")
        assert_rejected(root, [""], "nonempty literal path")


def test_sensitive_removals_can_be_committed_without_readding_local_files():
    flow = _load_script("commit_flow")
    for explicit in (False, True):
        with repository() as root:
            names = [".env", ".idea/config", "__pycache__/module.pyc"]
            for name in names:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("previously tracked")
            _git(str(root), "add", "--", *names)
            _git(str(root), "commit", "-qm", "tracked sensitive fixtures")
            _git(str(root), "rm", ".env", ".idea/config")
            _git(str(root), "rm", "--cached", "__pycache__/module.pyc")
            flow.stage(str(root), names if explicit else [], [])
            changes = staged_changes(root)
            assert {c.path for c in changes} == set(names)
            assert all(c.new_mode == "000000" for c in changes)
            _git(str(root), "commit", "-qm", "remove sensitive fixtures")
            tracked = set(_git_out(str(root), "ls-tree", "-r", "--name-only", "HEAD").splitlines())
            assert tracked.isdisjoint(names)
            assert (root / "__pycache__/module.pyc").read_text() == "previously tracked"


def test_sensitive_deletion_does_not_exempt_other_sensitive_writes():
    for mutation in ("add", "modify", "recreate"):
        with repository() as root:
            for name in (".env", ".env.local"):
                (root / name).write_text("previously tracked")
            _git(str(root), "add", ".env", ".env.local")
            _git(str(root), "commit", "-qm", "tracked sensitive fixtures")
            _git(str(root), "rm", ".env")
            name = {"add": ".env.new", "modify": ".env.local", "recreate": ".env"}[mutation]
            (root / name).write_text("new content")
            _git(str(root), "add", "--", name)
            assert_rejected(root, [], "sensitive")


if __name__ == "__main__":
    run_main(globals())

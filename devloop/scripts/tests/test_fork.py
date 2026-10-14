"""Fork repository identity and the full source-push / target-base workflow."""
from _testkit import _FakeForge, _git, _git_out, _load_script, run_main

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from harness_common import Forge as ForgeIdentity, Repository
from domain import pull_request, rebase, worktree
from domain.forge import ForgeError, PullRequest
from lib.forge import ForgeResolution


class RepositoryForge(_FakeForge):
    def __init__(self, path="fork/repo", parent="upstream/repo", prs=()):
        super().__init__(prs)
        self.path, self.parent = path, parent
        self.source_repository = path

    def repository(self):
        return Repository(ForgeIdentity("github"), self.path, forked_from=self.parent)

    def for_repository(self, path, *, source_repository=""):
        result = RepositoryForge(path, None, self._prs.values())
        result.source_repository = source_repository or path
        return result

    def default_branch(self):
        return "trunk" if self.path == "upstream/repo" else "main"


def test_fork_target_scope_and_absent_parent():
    with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge()):
        target = pull_request.forge_for_pull_requests("/repo")
        assert target.path == "upstream/repo"
        assert target.source_repository == "fork/repo"
    with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge(parent=None)):
        target = pull_request.forge_for_pull_requests("/repo")
        assert target.path == target.source_repository == "fork/repo"
    with patch.object(pull_request, "forge_for_repo", side_effect=ForgeError("denied")):
        try:
            pull_request.forge_for_pull_requests("/repo")
            assert False, "lookup failure cannot be treated as no parent"
        except ForgeError:
            pass


def test_target_without_parent_clone_uses_own_ref():
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "main")
        _git(root, "remote", "add", "origin", "git@github.com:fork/repo.git")
        resolution = ForgeResolution("github", "github.com", "github.com", "fork/repo", "token")
        with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge()), \
             patch.object(pull_request, "resolve_forge", return_value=resolution):
            target = pull_request.target_base(root)
        assert target.branch == "trunk"
        assert target.remote == "https://github.com/upstream/repo.git"
        assert target.ref == "refs/devloop/targets/github.com/upstream/repo/trunk"
        assert _git_out(root, "remote") == "origin"


def test_fork_rebase_fetches_parent_and_publishes_only_to_origin():
    with TemporaryDirectory() as root:
        root = Path(root)
        fork, upstream, repo = (root / name for name in ("fork.git", "upstream.git", "repo"))
        for bare in (fork, upstream):
            bare.mkdir()
            _git(str(bare), "init", "--bare", "-q")
        repo.mkdir()
        _git(str(repo), "init", "-q", "-b", "main")
        _git(str(repo), "config", "user.name", "Test")
        _git(str(repo), "config", "user.email", "test@example.com")
        (repo / "base").write_text("base")
        _git(str(repo), "add", "base")
        _git(str(repo), "commit", "-qm", "base")
        _git(str(repo), "remote", "add", "origin", str(fork))
        _git(str(repo), "push", "-qu", "origin", "main")
        _git(str(repo), "push", "-q", str(upstream), "main:trunk")
        _git(str(repo), "checkout", "-qb", "fix")
        (repo / "feature").write_text("feature")
        _git(str(repo), "add", "feature")
        _git(str(repo), "commit", "-qm", "feature")
        _git(str(repo), "push", "-qu", "origin", "fix")
        _git(str(repo), "checkout", "-q", "main")
        (repo / "parent-only").write_text("new upstream commit")
        _git(str(repo), "add", "parent-only")
        _git(str(repo), "commit", "-qm", "upstream")
        _git(str(repo), "push", "-q", str(upstream), "main:trunk")
        upstream_sha = _git_out(str(upstream), "rev-parse", "trunk")
        _git(str(repo), "checkout", "-q", "fix")
        target = pull_request.TargetBase("trunk", str(upstream), "refs/devloop/targets/upstream/trunk")
        with patch.object(rebase, "target_base", return_value=target):
            rebase.start(str(repo), "trunk")
        assert (repo / "parent-only").exists()
        state = rebase.load_state(str(repo))
        assert state.target_ref == target.ref and state.target_sha == upstream_sha
        rebase.finish(str(repo))
        assert _git_out(str(fork), "rev-parse", "fix") == _git_out(str(repo), "rev-parse", "HEAD")
        assert _git_out(str(upstream), "rev-parse", "trunk") == upstream_sha
        assert "refs/heads/fix" not in _git_out(str(upstream), "show-ref")
        with patch.object(worktree, "target_base", return_value=target), \
             patch.object(worktree, "prepare_environment", return_value=[]):
            path, detail = worktree.create_or_reuse(str(repo), "from-parent")
        assert path, detail
        assert _git_out(path, "rev-parse", "HEAD") == upstream_sha


def test_reuse_requires_target_branch_and_fork_scope():
    flow = _load_script("commit_flow")
    forge = _FakeForge([PullRequest(number=3, state="open", source_branch="fix", target_branch="release")])
    with patch.object(flow, "forge_for_pull_requests", return_value=forge):
        result = flow.reuse_or_create_pr("/repo", "fix", "main", "Fix", "", [])
    assert result.number == 4 and result.target_branch == "main"


def test_gate_ignores_other_forks_with_the_same_branch():
    from domain.context import gate, store
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "fix")
        _git(root, "remote", "add", "origin", "git@github.com:fork/repo.git")
        store.save_segment(root, "pr", {
            "branch": "fix", "source_repository": "fork/repo", "pr_number": 8,
            "prs": [
                {"number": 9, "state": "open", "source_branch": "fix", "source_repository": "other/repo"},
                {"number": 8, "state": "open", "source_branch": "fix", "source_repository": "fork/repo"},
            ],
        })
        assert gate.evaluate(root).active_pr.number == 8


if __name__ == "__main__":
    run_main(globals())

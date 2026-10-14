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


    def create(self, **kwargs):
        pr = super().create(**kwargs)
        pr.source_repository = self.source_repository
        pr.target_repository = self.path
        return pr


def test_fork_target_defaults_current_and_parent_is_explicit():
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "fix")
        with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge()):
            target = pull_request.forge_for_pull_requests(root)
            assert target.path == target.source_repository == "fork/repo"
            target = pull_request.forge_for_pull_requests(root, "parent")
            assert target.path == "upstream/repo" and target.source_repository == "fork/repo"
        with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge(parent=None)):
            try:
                pull_request.forge_for_pull_requests(root, "parent")
                assert False, "parent selection must not silently become a same-repository PR"
            except ForgeError:
                pass
        with patch.object(pull_request, "forge_for_repo", side_effect=ForgeError("denied")):
            try:
                pull_request.forge_for_pull_requests(root, "parent")
                assert False, "lookup failure cannot be treated as no parent"
            except ForgeError:
                pass


def test_current_baseline_does_not_require_forge_metadata():
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "main")
        with patch.object(pull_request, "forge_for_repo", side_effect=AssertionError("unneeded API")):
            baseline = pull_request.target_base(root)
        assert baseline.remote == "origin" and baseline.ref == "origin/main"


def test_recorded_target_is_branch_local_and_survives_lifecycle_calls():
    from domain.context import prstate
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "main")
        _git(root, "config", "user.name", "Test")
        _git(root, "config", "user.email", "test@example.com")
        _git(root, "commit", "--allow-empty", "-qm", "base")
        _git(root, "branch", "contribute")
        pull_request.remember_target(root, "contribute", "upstream/repo")
        assert pull_request.target_selection(root) == "current"
        assert pull_request.target_selection(root, branch="contribute") == "upstream/repo"
        assert pull_request.target_selection(root, "current", branch="contribute") == "current"
        visited = []
        def for_branch(repo, selection=None):
            visited.append(selection or pull_request.target_selection(repo))
            return _FakeForge([])
        with patch.object(prstate, "forge_for_pull_requests", for_branch):
            assert prstate.poll_local_pull_requests(root) is not None
        assert "current" in visited and "upstream/repo" in visited
        _git(root, "checkout", "-q", "contribute")
        with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge()):
            assert pull_request.forge_for_pull_requests(root).path == "upstream/repo"
            assert pull_request.forge_for_pull_requests(root, "current").path == "fork/repo"
        assert pull_request.target_selection(root, branch="fresh-work") == "current"


def test_creation_argument_selects_target_before_publication():
    flow = _load_script("commit_flow")
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "fix")
        _git(root, "remote", "add", "origin", "git@github.com:fork/repo.git")
        resolution = ForgeResolution("github", "github.com", "github.com", "fork/repo", "token")
        with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge()), \
             patch.object(pull_request, "resolve_forge", return_value=resolution):
            parser = flow._build_parser()
            args = parser.parse_args(["mr", "--message", "Fix", "--repo", root, "--target-repo", "parent"])
            intent = flow.resolve_intent(args, root)
            assert intent.target_repository == "upstream/repo" and intent.target == "trunk"
            pr = flow.reuse_or_create_pr(root, "fix", intent.target, "Fix", "", [],
                                         target_repo=intent.target_repository)
            assert pr.target_branch == "trunk" and pr.target_repository == "upstream/repo"
            args = parser.parse_args(["mr", "--message", "Fix", "--repo", root])
            intent = flow.resolve_intent(args, root)
            assert intent.target_repository == "current" and intent.target_remote == "origin"




def test_remote_poll_includes_selected_parent_default_branch():
    from domain.context import prstate
    target = pull_request.TargetBase("trunk", "upstream", "refs/devloop/targets/upstream/trunk", "upstream/repo")
    with patch.object(prstate, "target_base", return_value=target), \
         patch.object(prstate.git_state, "ls_remote_tips", return_value={"trunk": "abc"}) as tips:
        assert prstate.poll_remote_branches("/repo")["remotes"] == [{"name": "trunk", "commit": "abc"}]
    tips.assert_called_once_with("/repo", "main", "master", "release", "trunk", remote="upstream")


def test_gcampr_records_parent_target_and_pushes_to_origin():
    from domain.context import prstate
    from test_worktree import _fixture
    flow = _load_script("commit_flow")
    repo, origin, _ = _fixture("explicit_pr_target")
    _git(repo, "checkout", "-qb", "contribution")
    Path(repo, "feature.txt").write_text("feature")
    forge = RepositoryForge("upstream/repo", None)
    forge.source_repository = "fork/repo"
    baseline = pull_request.TargetBase("main", "origin", "origin/main", "upstream/repo")
    with patch.object(flow, "target_base", return_value=baseline), \
         patch.object(flow, "forge_for_pull_requests", return_value=forge) as endpoint, \
         patch.object(prstate, "forge_for_pull_requests", return_value=forge):
        assert flow.main(["mr", "--repo", repo, "--message", "Add feature",
                          "--target-repo", "parent", "--file", "feature.txt"]) == 0
    endpoint.assert_called_once_with(str(Path(repo).resolve()), "upstream/repo")
    assert forge.created.target_repository == "upstream/repo"
    assert pull_request.target_selection(repo) == "upstream/repo"
    assert _git_out(origin, "rev-parse", "contribution") == _git_out(repo, "rev-parse", "HEAD")
    assert pull_request.target_selection(repo, branch="unrelated-work") == "current"


def test_target_without_parent_clone_uses_own_ref():
    with TemporaryDirectory() as root:
        _git(root, "init", "-q", "-b", "main")
        _git(root, "remote", "add", "origin", "git@github.com:fork/repo.git")
        resolution = ForgeResolution("github", "github.com", "github.com", "fork/repo", "token")
        with patch.object(pull_request, "forge_for_repo", return_value=RepositoryForge()), \
             patch.object(pull_request, "resolve_forge", return_value=resolution):
            target = pull_request.target_base(root, target_repo="parent")
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
        target = pull_request.TargetBase("trunk", str(upstream), "refs/devloop/targets/upstream/trunk", "upstream/repo")
        pull_request.remember_target(str(repo), "fix", "upstream/repo")
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
            path, detail = worktree.create_or_reuse(str(repo), "from-parent", target_repo="parent")
        assert path, detail
        assert _git_out(path, "rev-parse", "HEAD") == upstream_sha
        assert pull_request.target_selection(path) == "upstream/repo"


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

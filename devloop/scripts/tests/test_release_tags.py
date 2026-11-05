"""Managed immutable tags for repository-owned release CI."""
from pathlib import Path
from tempfile import TemporaryDirectory

from _testkit import _git, _git_out, _load_script, run_main


def test_release_tags_publish_together_and_never_move():
    release = _load_script("release")
    with TemporaryDirectory(prefix="devloop-release-tags-") as directory:
        root = Path(directory)
        repo, remote = root / "repo", root / "remote.git"
        repo.mkdir()
        _git(str(repo), "init", "-q")
        _git(str(repo), "config", "user.name", "Test")
        _git(str(repo), "config", "user.email", "test@example.com")
        _git(str(root), "init", "--bare", "-q", str(remote))
        _git(str(repo), "remote", "add", "origin", str(remote))
        (repo / "VERSION").write_text("1.0.0")
        _git(str(repo), "add", "VERSION")
        _git(str(repo), "commit", "-qm", "first")
        first = _git_out(str(repo), "rev-parse", "HEAD")
        tags = ["toolkit/go/v1.0.0", "apps/cli/v1.0.0"]
        release.publish_tags(str(repo), tags, "HEAD")
        release.publish_tags(str(repo), tags, first)
        for tag in tags:
            assert _git_out(str(remote), "rev-parse", f"refs/tags/{tag}") == first
        (repo / "VERSION").write_text("1.0.1")
        _git(str(repo), "commit", "-qam", "second")
        try:
            release.publish_tags(str(repo), [tags[0], "v1.0.1"], "HEAD")
            raise AssertionError("tag replacement was accepted")
        except ValueError as error:
            assert "refusing to move" in str(error)
        assert _git_out(str(remote), "tag", "--list", "v1.0.1") == ""
        for tag in ["../v1.0.0", "v1.0", "-v1.0.0"]:
            try:
                release.publish_tags(str(repo), [tag], first)
                raise AssertionError("invalid tag accepted")
            except ValueError:
                pass


def test_release_tag_batch_is_atomic_when_remote_rejects_one_ref():
    """@case A per-ref rejection must leave every tag in the batch absent."""
    from repokit import git

    release = _load_script("release")
    with TemporaryDirectory(prefix="devloop-atomic-tags-") as directory:
        root = Path(directory)
        repo, remote = root / "repo", root / "remote.git"
        repo.mkdir()
        _git(str(repo), "init", "-q")
        _git(str(repo), "config", "user.name", "Test")
        _git(str(repo), "config", "user.email", "test@example.com")
        _git(str(repo), "commit", "--allow-empty", "-qm", "initial")
        _git(str(root), "init", "--bare", "-q", str(remote))
        _git(str(repo), "remote", "add", "origin", str(remote))
        hook = remote / "hooks/update"
        # pre-receive rejects the entire batch even without --atomic; update is per ref.
        hook.write_text('#!/bin/sh\n[ "$1" != "refs/tags/apps/cli/v1.0.0" ]\n')
        hook.chmod(0o755)
        _git(str(remote), "config", "core.hooksPath", str(hook.parent))
        tags = ["toolkit/go/v1.0.0", "apps/cli/v1.0.0"]
        try:
            release.publish_tags(str(repo), tags, "HEAD")
            raise AssertionError("remote rejection was accepted")
        except ValueError as error:
            assert "release tags not confirmed" in str(error)
        assert _git_out(str(remote), "tag", "--list") == ""

        # Negative control: the same remote must allow partial publication without --atomic.
        commit = _git_out(str(repo), "rev-parse", "HEAD")
        result = git.git(str(repo), "push", "origin", *[f"{commit}:refs/tags/{tag}" for tag in tags])
        assert not result.ok
        assert _git_out(str(remote), "tag", "--list") == tags[0]


if __name__ == "__main__":
    run_main(globals())

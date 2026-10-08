"""Workflow choices over repository facts remain owned by devloop."""
from unittest.mock import patch

from _testkit import run_main
from lib import git_state


def test_cached_default_branch_takes_precedence_over_fallbacks():
    with patch.object(git_state, "local_default_branch", return_value="release/stable"), \
            patch.object(git_state, "target_exists") as exists:
        assert git_state.local_default_target("repo") == "release/stable"
        exists.assert_not_called()


def test_missing_default_branch_uses_devloop_main_master_policy():
    for branches, expected in (({"main", "master"}, "main"), ({"master"}, "master"), (set(), "main")):
        with patch.object(git_state, "local_default_branch", return_value=None), \
                patch.object(git_state, "target_exists", side_effect=lambda _repo, b: b in branches):
            assert git_state.local_default_target("repo") == expected


def test_failed_default_branch_read_never_selects_a_fallback():
    with patch.object(git_state, "local_default_branch", side_effect=OSError("read failed")), \
            patch.object(git_state, "target_exists") as exists:
        try:
            git_state.local_default_target("repo")
        except OSError as error:
            assert str(error) == "read failed"
        else:
            raise AssertionError("read failure was treated as a missing default branch")
        exists.assert_not_called()


def test_local_exclusion_is_best_effort_in_devloop():
    with patch.object(git_state.gitcmd, "add_exclude", side_effect=PermissionError("denied")):
        git_state.ensure_gitignore_excluded("repo")


if __name__ == "__main__":
    run_main(globals())

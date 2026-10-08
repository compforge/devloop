"""Test devloop decisions with repocli observations, not another package-tool detector."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from _testkit import run_main
from test_test_scope import has_full_stamp, make_repo, run_check
from lib import dependencies
from repocli import DependencyPreparation, inspect_dependencies


def test_existing_bun_installation_can_enter_validation_without_auto_prepare():
    with TemporaryDirectory() as tmp:
        root = Path(make_repo(tmp))
        (root / "package.json").write_text(json.dumps({"name": "fixture", "packageManager": "bun@1.3.11"}))
        (root / "bun.lock").write_text("fixture")
        (root / "node_modules").mkdir()
        with patch.object(dependencies, "prepare_dependencies", side_effect=AssertionError("already present")):
            assert dependencies.preparation_problem(root) is None
        assert inspect_dependencies(root)[0].status == "present"


def test_missing_environment_delegates_to_repocli_and_preserves_failure_reason():
    with TemporaryDirectory() as tmp:
        root = Path(make_repo(tmp))
        (root / "package.json").write_text('{"name":"fixture","packageManager":"bun@1.3.11"}')
        (root / "bun.lock").write_text("fixture")
        environment, = inspect_dependencies(root)
        result = DependencyPreparation(environment, "failed", True, 7, stderr="registry unavailable", reason="install failed")
        with patch.object(dependencies, "prepare_dependencies", return_value=result) as prepare:
            problem = dependencies.preparation_problem(root)
        assert prepare.call_count == 1
        assert "failed: bun" in problem and "registry unavailable" in problem


def test_workspace_member_uses_repocli_installation_root():
    with TemporaryDirectory() as tmp:
        root = Path(make_repo(tmp))
        (root / "package.json").write_text('{"name":"fixture","workspaces":["packages/*"],"packageManager":"bun@1.3.11"}')
        (root / "bun.lock").write_text("fixture")
        member = root / "packages" / "child"
        member.mkdir(parents=True)
        (member / "package.json").write_text('{"name":"child"}')
        environment, = inspect_dependencies(member)
        assert environment.root == root
        with patch.object(dependencies, "prepare_dependencies", return_value=DependencyPreparation(environment, "ready")) as prepare:
            assert dependencies.preparation_problem(member) is None
        assert prepare.call_args.args[0].root == root


def test_observation_failure_does_not_turn_into_a_ready_environment():
    for error in (ValueError("incomplete checkout"), PermissionError("cannot observe dependency directory")):
        with patch.object(dependencies, "inspect_dependencies", side_effect=error):
            assert str(error) in dependencies.preparation_problem("unused")


def test_unlocked_distribution_manifest_runs_project_checks_and_preserves_their_result():
    for passes in (True, False):
        with TemporaryDirectory() as tmp:
            root = Path(make_repo(tmp))
            (root / "go.mod").write_text("module example.com/cli\n\ngo 1.22\n")
            (root / "package.json").write_text(json.dumps({
                "name": "cli-distribution",
                "bin": {"cli": "bin/cli.js"},
                "optionalDependencies": {"cli-darwin-arm64": "0.0.0"},
            }))
            if not passes:
                (root / "test_b.py").write_text("BAD\n")
            with patch.object(dependencies, "prepare_dependencies", side_effect=AssertionError("no locked installer")):
                result, _ = run_check(root)
            assert result.ok == passes, result.summary
            assert (root / "test.observed").read_text() == "test_a.py test_b.py"
            assert has_full_stamp(root) == passes
            assert not (root / "node_modules").exists()
            assert inspect_dependencies(root)[0].status == "missing"


def test_unlocked_required_dependencies_are_left_to_project_checks():
    with TemporaryDirectory() as tmp:
        root = Path(make_repo(tmp))
        (root / "package.json").write_text('{"name":"fixture","dependencies":{"some-package":"1.0.0"}}')
        with patch.object(dependencies, "prepare_dependencies", side_effect=AssertionError("no locked installer")):
            assert dependencies.preparation_problem(root) is None
        assert not (root / "node_modules").exists()


def test_dependency_symlinks_still_block_with_or_without_a_lockfile():
    for locked in (True, False):
        for exists in (True, False):
            with TemporaryDirectory() as tmp, TemporaryDirectory() as other:
                root = Path(make_repo(tmp))
                (root / "package.json").write_text('{"name":"fixture"}')
                if locked:
                    (root / "package-lock.json").write_text('{}')
                target = Path(other) / "node_modules"
                if exists:
                    target.mkdir()
                (root / "node_modules").symlink_to(target, target_is_directory=True)
                problem = dependencies.preparation_problem(root)
                assert problem and "symlink" in problem, problem
                assert not (root / "test.observed").exists()


def test_unlocked_environment_with_invalid_directory_still_blocks():
    with TemporaryDirectory() as tmp:
        root = Path(make_repo(tmp))
        (root / "package.json").write_text('{"name":"fixture"}')
        (root / "node_modules").write_text("not a directory")
        assert dependencies.preparation_problem(root) is not None


if __name__ == "__main__":
    run_main(globals())

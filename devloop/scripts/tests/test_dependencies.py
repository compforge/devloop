"""Test devloop decisions with repocli observations, not another package-tool detector."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from _testkit import run_main
from test_test_scope import make_repo
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
    with patch.object(dependencies, "inspect_dependencies", side_effect=ValueError("incomplete checkout")):
        assert "incomplete checkout" in dependencies.preparation_problem("unused")


if __name__ == "__main__":
    run_main(globals())

"""Component check caching keeps affected-file selection and snapshot safety independent."""
from __future__ import annotations

import io
import json
from contextlib import redirect_stdout
from pathlib import Path
from tempfile import TemporaryDirectory

from _testkit import _git, repocli_report, run_main
from domain.context.store import load_segment
from domain.lifecycle import checks
from domain.repo import WorkSet
from domain.repo_layout import inspect_catalog
from domain.validation import Plan, ComponentPlan, planned_check, Selection, build_plan, content_identity
from domain.validation_inputs import check_inputs, input_policy
from domain.validation_evidence import evidence_segment


def fixture(root):
    repo = Path(root)
    _git(repo, "init", "-qb", "main")
    (repo / ".gitignore").write_text(".devloop/\n*.observed\n")
    for component in ("a", "b", "c"):
        folder = repo / component
        folder.mkdir()
        (folder / "Makefile").write_text(
            "test:\n\t@echo '$(TEST_FILES)' >> test.observed\n"
            "lint:\n\t@echo '$(LINT_FILES)' >> lint.observed\n")
        (folder / "code.py").write_text("value = 1\n")
        (folder / "test_one.py").write_text("pass\n")
        (folder / "test_two.py").write_text("pass\n")
    (repo / "shared.cfg").write_text("initial")
    (repo / ".devloop").mkdir()
    policy(repo, {"a": {"test": {"components": ["b"], "paths": ["shared.cfg"]},
                        "lint": {"components": [], "paths": []}}})
    return repo


def policy(repo, declarations):
    (repo / ".devloop/config.json").write_text(json.dumps({"validation": {"inputs": declarations}}))


def plan_for(repo, files=("test_one.py",)):
    catalog = inspect_catalog(repo)
    component = next(c for c in catalog.components if c.id == "a")
    current = content_identity(str(repo)).digest
    declaration = input_policy(str(repo))
    selected = {(component.id, check): Selection(files, "fixture impact") for check in ("lint", "test")}
    identities = check_inputs(str(repo), catalog, tuple(selected), current, declaration)
    return component, Plan(WorkSet((component,), "fixture"),
                           (ComponentPlan(component, None, {check: planned_check(component, check, selected[(component.id, check)], identities[(component.id, check)]) for check in ("lint", "test")}),),
                           execution_identity=current, input_policy=declaration)


def execute(repo, component, plan, check="test"):
    with redirect_stdout(io.StringIO()):
        return getattr(checks, check)(str(repo), component=component, plan=plan)


@repocli_report()
def test_unrelated_component_reuses_both_checks_and_rebinds_snapshot():
    with TemporaryDirectory() as root:
        repo = fixture(root)
        component, first = plan_for(repo)
        for check in ("lint", "test"):
            assert execute(repo, component, first, check).ok
        original = load_segment(str(repo), evidence_segment(str(repo), "a", "test"))
        (repo / "c/code.py").write_text("unrelated edit")
        component, second = plan_for(repo)
        assert first.execution_identity != second.execution_identity
        for check in ("lint", "test"):
            result = execute(repo, component, second, check)
            assert result.ok and "reused passed" in result.summary, result.summary
            assert len((repo / "a" / (check + ".observed")).read_text().splitlines()) == 1
        evidence = load_segment(str(repo), evidence_segment(str(repo), "a", "test"))
        assert evidence["identity"]["snapshot"] == second.execution_identity
        assert evidence["checked_at"] == original["checked_at"]


@repocli_report()
def test_dependency_shared_config_and_membership_invalidate_only_selected_check():
    with TemporaryDirectory() as root:
        repo = fixture(root)
        component, plan = plan_for(repo)
        assert execute(repo, component, plan).ok
        assert execute(repo, component, plan, "lint").ok
        for path in ("b/code.py", "shared.cfg", "b/new.py"):
            (repo / path).write_text("changed")
            component, plan = plan_for(repo)
            result = execute(repo, component, plan)
            assert result.ok and "reused" not in result.summary, result.summary
            assert "reused" in execute(repo, component, plan, "lint").summary
        (repo / "b/new.py").unlink()
        component, plan = plan_for(repo)
        assert "reused" not in execute(repo, component, plan).summary
        assert (repo / "a/test.observed").read_text().splitlines() == ["test_one.py"] * 5


@repocli_report()
def test_selection_and_declaration_changes_do_not_reuse_old_results():
    with TemporaryDirectory() as root:
        repo = fixture(root)
        component, first = plan_for(repo)
        assert execute(repo, component, first).ok
        component, selected = plan_for(repo, ("test_two.py",))
        assert "reused" not in execute(repo, component, selected).summary
        policy(repo, {"a": {"test": {"components": ["b", "c"], "paths": ["shared.cfg"]}}})
        assert not execute(repo, component, selected).ok  # ignored config is also a frozen input
        component, changed = plan_for(repo, ("test_two.py",))
        assert "reused" not in execute(repo, component, changed).summary
        assert (repo / "a/test.observed").read_text().splitlines() == ["test_one.py", "test_two.py", "test_two.py"]


@repocli_report()
def test_missing_invalid_and_cross_scope_link_inputs_fall_back_conservatively():
    with TemporaryDirectory() as root:
        repo = fixture(root)
        for declarations in ({}, {"a": {"test": {"components": ["missing"], "paths": []}}},
                             {"a": {"test": {"components": [], "paths": ["../outside"]}}}):
            policy(repo, declarations)
            component, plan = plan_for(repo)
            assert plan.inputs[("a", "test")].fingerprint == plan.execution_identity
            assert "repository inputs" in plan.inputs[("a", "test")].reason
            assert execute(repo, component, plan).ok
            (repo / "c/code.py").write_text((repo / "c/code.py").read_text() + "edit")
            component, changed = plan_for(repo)
            assert "reused" not in execute(repo, component, changed).summary
        policy(repo, {"a": {"test": {"components": [], "paths": []}}})
        (repo / "a/alias").symlink_to("../b/code.py")
        _, plan = plan_for(repo)
        assert "outside scope" in plan.inputs[("a", "test")].reason


@repocli_report()
def test_execution_mutation_never_records_a_pass():
    with TemporaryDirectory() as root:
        repo = fixture(root)
        (repo / "a/Makefile").write_text("test:\n\t@echo changed >> ../c/code.py\n")
        component, plan = plan_for(repo, ())
        result = execute(repo, component, plan)
        assert not result.ok and "contents changed" in result.summary
        assert not load_segment(str(repo), evidence_segment(str(repo), "a", "test"))


@repocli_report(sources=["a/code.py"], tests=["a/test_one.py"])
def test_automatic_plan_keeps_impact_scope_when_component_fingerprint_changes():
    with TemporaryDirectory() as root:
        repo = fixture(root)
        catalog = inspect_catalog(repo)
        workset = WorkSet(catalog.components, "fixture", catalog=catalog)
        with redirect_stdout(io.StringIO()):
            first = build_plan(str(repo), workset, paths=["a/code.py"])
        assert [unit.id for unit in first.workset.components] == ["a"]
        component = first.workset.components[0]
        assert first.selection(component, "test").files == ("test_one.py",)
        assert first.inputs[("a", "test")].fingerprint.startswith("check-inputs-v1:")
        assert execute(repo, component, first).ok
        (repo / "b/code.py").write_text("dependency edit")
        with redirect_stdout(io.StringIO()):
            second = build_plan(str(repo), workset, paths=["a/code.py", "b/code.py"])
        assert second.selection(component, "test").files == ("test_one.py",)
        assert first.inputs[("a", "test")].fingerprint != second.inputs[("a", "test")].fingerprint
        assert "reused" not in execute(repo, component, second).summary
        assert (repo / "a/test.observed").read_text().splitlines() == ["test_one.py", "test_one.py"]


def test_component_files_are_authoritative_and_command_is_frozen():
    with TemporaryDirectory() as root, repocli_report(sources=["a/code.py"], tests=["a/test_one.py"]) as cli:
        repo = fixture(root)
        cli.write_text(cli.read_text().replace("print(json.dumps(data))",
            "data['components'][0]['testFiles']=['a/test_two.py']\nprint(json.dumps(data))"))
        catalog = inspect_catalog(repo)
        plan = build_plan(str(repo), WorkSet(catalog.components, "fixture", catalog=catalog), paths=["a/code.py"])
        component = plan.workset.components[0]
        check = plan.check(component, "test")
        assert check.selection.files == ("test_two.py",)
        assert check.command == ("make", "test", "TEST_FILES=test_two.py")
        assert execute(repo, component, plan).ok
        assert (repo / "a/test.observed").read_text().splitlines() == ["test_two.py"]


def test_deleted_component_input_falls_back_without_widening_other_components():
    with TemporaryDirectory() as root, repocli_report(sources=["a/code.py", "b/code.py"]) as cli:
        repo = fixture(root)
        cli.write_text(cli.read_text().replace("print(json.dumps(data))",
            "data['components'][0]['affectedFiles'].append('a/deleted.py')\nprint(json.dumps(data))"))
        catalog = inspect_catalog(repo)
        plan = build_plan(str(repo), WorkSet(catalog.components, "fixture", catalog=catalog))
        a, b = plan.workset.components
        assert plan.selection(a, "lint").scope == "full"
        assert "deleted" in plan.selection(a, "lint").reason
        assert plan.selection(b, "lint").files == ("code.py",)


def test_unowned_evidence_is_visible_without_inventing_an_execution_target():
    with TemporaryDirectory() as root, repocli_report() as cli:
        repo = fixture(root)
        cli.write_text(cli.read_text().replace("print(json.dumps(data))",
            "data['unowned'].update(affected=True, affectedFileCounts={'config':1}, affectedFiles=['shared.cfg'])\nprint(json.dumps(data))"))
        catalog = inspect_catalog(repo)
        plan = build_plan(str(repo), WorkSet(catalog.components, "fixture", catalog=catalog))
        assert not plan.workset.components
        assert plan.unowned.affected_files == ("shared.cfg",)
        assert plan.unowned.counts == {"config": 1}


if __name__ == "__main__":
    run_main(globals())

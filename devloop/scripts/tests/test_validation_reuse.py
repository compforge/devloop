#!/usr/bin/env python3
"""Successful validation is reusable only for identical check inputs."""
from __future__ import annotations

from dataclasses import replace
import io
from contextlib import redirect_stdout
from tempfile import TemporaryDirectory
from unittest.mock import patch

from _testkit import _load_script, repocli_report, run_main
from test_test_scope import make_repo, has_full_stamp
from domain.lifecycle import checks
from domain.lifecycle.base import HookResult, dispatch
from domain.repo import WorkSet
from domain.repo_layout import Component
from domain.validation import Plan, Selection, content_identity
from domain.validation_result import CheckRun


def plan_for(repo, *, files=(), full=False):
    unit = Component.at(repo, repo)
    selection = Selection(files=() if full else files, reason="fixture")
    return unit, Plan(WorkSet((unit,), "fixture"),
                     selections={(unit.id, check): selection for check in ("lint", "test")},
                     execution_identity=content_identity(str(repo)).digest)


def invoke(repo, unit, plan, check="test", **kwargs):
    with redirect_stdout(io.StringIO()):
        return getattr(checks, check)(str(repo), component=unit, plan=plan, **kwargs)


@repocli_report()
def test_same_test_inputs_reuse_without_running_or_promoting_focused_stamp():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        unit, plan = plan_for(repo, files=("test_a.py",))
        first = invoke(repo, unit, plan)
        assert first.ok and not has_full_stamp(repo)
        (repo / "test.observed").unlink()
        second = invoke(repo, unit, plan)
        assert second.ok and "reused passed test (focused)" in second.summary
        assert not (repo / "test.observed").exists() and not has_full_stamp(repo)
        unit, full = plan_for(repo, full=True)
        assert invoke(repo, unit, full).ok
        assert (repo / "test.observed").read_text() == "test_a.py test_b.py"
        assert has_full_stamp(repo)


@repocli_report()
def test_changed_content_and_selection_execute_again():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        unit, plan = plan_for(repo, files=("test_a.py",))
        assert invoke(repo, unit, plan).ok
        (repo / "source.py").write_text("VALUE = 2\n")
        unit, changed = plan_for(repo, files=("test_a.py",))
        result = invoke(repo, unit, changed)
        assert result.ok and "reused" not in result.summary
        unit, selected = plan_for(repo, files=("test_b.py",))
        assert invoke(repo, unit, selected).ok
        assert (repo / "test.observed").read_text() == "test_b.py"
        # A stale plan must fail before consulting any cached success.
        assert not invoke(repo, unit, plan).ok


@repocli_report()
def test_lint_reuses_only_after_stable_success():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        with (repo / "Makefile").open("a") as file:
            file.write("lint:\n\t@echo run >> lint.observed\n")
        unit, plan = plan_for(repo, full=True)
        assert invoke(repo, unit, plan, "lint").ok
        result = invoke(repo, unit, plan, "lint")
        assert result.ok and "reused passed lint (full)" in result.summary
        assert (repo / "lint.observed").read_text().splitlines() == ["run"]


@repocli_report()
def test_failed_tests_execute_on_every_attempt():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        (repo / "test_a.py").write_text("BAD\n")
        unit, plan = plan_for(repo, full=True)
        assert not invoke(repo, unit, plan).ok
        (repo / "test.observed").unlink()
        assert not invoke(repo, unit, plan).ok
        assert (repo / "test.observed").exists() and not has_full_stamp(repo)


@repocli_report()
def test_reuse_does_not_bypass_dependency_preparation_failure():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        unit, plan = plan_for(repo, full=True)
        assert invoke(repo, unit, plan).ok
        with patch.object(checks, "_environment_failure", return_value=HookResult("test", ok=False)):
            assert not invoke(repo, unit, plan).ok


@repocli_report()
def test_check_identity_and_non_success_records_never_authorize_reuse():
    with TemporaryDirectory() as root:
        repo = make_repo(root)
        run = CheckRun(str(repo), ".", "test", content_identity(str(repo)).digest,
                       ("make", "test", "TEST_FILES=test_a.py"), "focused", ("test_a.py",))
        run.record(HookResult("test", ok=True))
        assert run.reuse() is not None
        for changed in (replace(run, fingerprint="different"), replace(run, component="child"),
                        replace(run, check="lint"), replace(run, command=("make", "test-ci")),
                        replace(run, scope="full"), replace(run, files=("test_b.py",)),
                        replace(run, fingerprint=""), replace(run, environment="changed")):
            assert changed.reuse() is None
        for status in ("failed", "skipped", "unavailable"):
            run.record(HookResult("test", ok=status != "failed", status=status))
            assert run.reuse() is None


@repocli_report(sources=["source.py"], tests=["test_a.py"])
def test_manual_validation_then_commit_lifecycle_reuses_both_checks():
    with TemporaryDirectory() as root:
        repo = make_repo(root, contract=False)
        with (repo / "Makefile").open("a") as file:
            file.write("fix:\n\t@true\nlint:\n\t@echo run >> lint.observed\n")
        (repo / "source.py").write_text("VALUE = 2\n")
        runner = _load_script("run_validate")
        with redirect_stdout(io.StringIO()):
            assert runner.main([str(repo)]) == 0
        (repo / "test.observed").unlink()
        with redirect_stdout(io.StringIO()):
            result = dispatch("pre_commit", str(repo), paths=["source.py", "Makefile"],
                              names=["lint", "test"])
        assert result.proceed and all(item.ok for item in result.results)
        assert all("reused passed" in item.summary for item in result.results)
        assert (repo / "lint.observed").read_text().splitlines() == ["run"]
        assert not (repo / "test.observed").exists()


if __name__ == "__main__":
    run_main(globals())

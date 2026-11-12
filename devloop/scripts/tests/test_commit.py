"""Commit selection mechanics live in RepoKit; devloop verifies policy and CLI evidence."""
from unittest.mock import patch
import subprocess

from _testkit import run_main, _load_script
from domain import commit

REPO = "/tmp/devloop-commit-contract"
HEAD = "a" * 40
TREE = "b" * 40
INDEX = "c" * 64
SHA = "d" * 40


def report(**updates):
    data = dict(checkout=REPO, action="plan", branch="topic", head=HEAD, tree=TREE,
                indexFingerprint=INDEX, mode="files", paths=["src"], changes=[dict(path="src/a.py", newMode="100644")],
                empty=False, attempted=False, confirmed=False, diagnostics=[])
    data.update(updates)
    return dict(outcome="succeeded", data=data)


def prepared():
    return commit.Prepared(REPO, "topic", HEAD, TREE, INDEX, "files", ("src",), ("src/a.py",))


def created(**updates):
    return report(action="create", attempted=True, confirmed=True, commit=SHA, actualTree=TREE,
                  parents=[HEAD], indexInstalled=True, **updates)


def test_prepare_checks_policy_on_full_candidate_without_mutation():
    with patch.object(commit, "_call", return_value=report()) as call:
        assert commit.prepare(REPO, "topic", ["src"]) == prepared()
        call.assert_called_once_with(REPO, "plan", ["--mode", "files", "--file", "src"])
    for mode in ("100644", "120000", "160000"):
        with patch.object(commit, "_call", return_value=report(changes=[dict(path="src/.env", newMode=mode)])) as call:
            try: commit.prepare(REPO, "topic", ["src"]); assert False
            except commit.CommitError as e: assert "sensitive" in str(e)
            assert call.call_count == 1
    with patch.object(commit, "_call", return_value=report(changes=[dict(path=".env", newMode="000000")])):
        assert commit.prepare(REPO, "topic", ["src"]).paths == (".env",)


def test_default_selection_is_tracked_and_plan_identity_must_match():
    with patch.object(commit, "_call", return_value=report(mode="tracked", paths=[])) as call:
        commit.prepare(REPO, "topic", [])
        assert call.call_args.args[2] == ["--mode", "tracked"]
    for update in [dict(branch="other"), dict(checkout="/other"), dict(head=""), dict(tree="bad"),
                   dict(indexFingerprint="bad"), dict(changes=None), dict(empty=True), dict(attempted=True)]:
        with patch.object(commit, "_call", return_value=report(**update)):
            try: commit.prepare(REPO, "topic", ["src"]); assert False
            except commit.CommitError: pass


def test_create_forwards_frozen_intent_and_requires_matching_commit():
    with patch.object(commit, "_call", return_value=created()) as call:
        plan=[]
        assert commit.create(prepared(), "message", plan) == SHA
        args=call.call_args.args[2]
        assert args == ["--mode", "files", "--branch", "topic", "--head", HEAD, "--tree", TREE,
                        "--index-fingerprint", INDEX, "--message", "message", "--file", "src"]
        assert SHA in plan[0]
    cases=[created() for _ in range(6)]
    for result,updates in zip(cases,[dict(confirmed=False),dict(actualTree="f"*40),dict(parents=[]),dict(commit="bad"),dict(checkout="/other"),dict(tree="f"*40)]):
        result["data"].update(updates)
        with patch.object(commit,"_call",return_value=result) as call:
            try:commit.create(prepared(),"message",[]);assert False
            except commit.CommitError as e:assert "check" in str(e)
            assert call.call_count==1


def test_unknown_or_missing_commit_response_never_replays():
    result=created();result["outcome"]="unknown"
    for response,error in [(result,None),(None,subprocess.TimeoutExpired("repocli",180)),({},None)]:
        with patch.object(commit,"_call",return_value=response,side_effect=error) as call:
            try:commit.create(prepared(),"message",[]);assert False
            except commit.CommitError as e:assert HEAD in str(e) and TREE in str(e) and "--repo" in str(e)
            assert call.call_count==1


def test_confirmed_commit_with_uninstalled_index_stops_before_push():
    result=created();result["data"].update(indexInstalled=False,recoveryPath="/candidate")
    with patch.object(commit,"_call",return_value=result):
        plan=[]
        try:commit.create(prepared(),"message",plan);assert False
        except commit.CommitError as e:assert SHA in str(e) and "do not repeat commit" in str(e)
        assert SHA in plan[0]


def test_empty_selection_has_no_commit_call():
    from dataclasses import replace
    with patch.object(commit,"_call") as call:
        assert commit.create(replace(prepared(),paths=()),"message",[]) == ""
        call.assert_not_called()


def test_publish_uses_confirmed_commit_instead_of_rereading_head():
    flow=_load_script("commit_flow")
    from test_publish import envelope
    result=envelope(targetCommit=SHA,remoteCommit=SHA)
    with patch.object(flow.cli,"run_repocli",return_value=result),patch.object(flow.git_state,"rev_parse") as read:
        flow.publish_branch("/tmp/devloop-push-contract","topic",[],SHA)
        read.assert_not_called()


if __name__ == "__main__":
    run_main(globals())

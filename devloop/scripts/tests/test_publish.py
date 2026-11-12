"""Publication policy consumes confirmed RepoCLI evidence without replaying writes."""
import subprocess
from unittest.mock import patch
from _testkit import run_main
from test_git_ops import _load_script

SHA = "a" * 40
REPO = "/tmp/devloop-push-contract"

def envelope(**updates):
    data = dict(checkout=REPO, branch="topic", target="topic", remote="origin", targetCommit=SHA,
                remoteCommit=SHA, confirmed=True, diagnostics=[])
    data.update(updates)
    return dict(outcome="succeeded", data=data)


def test_push_freezes_commit_and_consumes_confirmed_remote_identity():
    flow = _load_script("commit_flow")
    with patch.object(flow.git_state,"rev_parse",return_value=SHA), patch.object(flow.cli,"run_repocli",return_value=envelope()) as invoke:
        plan=[];flow.publish_branch(REPO,"topic",plan)
        invoke.assert_called_once_with(REPO,("git","push"),["--branch","topic","--commit",SHA,"--remote","origin","--set-upstream"],timeout=300)
        assert plan == [f"confirmed origin/topic at {SHA}"]


def test_unavailable_unknown_or_mismatched_push_never_retries():
    flow = _load_script("commit_flow")
    cases = [(None, subprocess.TimeoutExpired("repocli",300)),
             ({"outcome":"unknown","data":envelope(confirmed=False)["data"]},None),
             (envelope(confirmed=False),None), (envelope(remoteCommit="b"*40),None),
             (envelope(checkout="/other"),None), (envelope(targetCommit="b"*40),None)]
    for result,error in cases:
        with patch.object(flow.git_state,"rev_parse",return_value=SHA), patch.object(flow.cli,"run_repocli",return_value=result,side_effect=error) as invoke, patch.object(flow.operations,"push") as fallback:
            try:flow.publish_branch(REPO,"topic",[]);assert False
            except flow.SmartError as exc:assert SHA in str(exc) and "--check" in str(exc)
            assert invoke.call_count==1
            fallback.assert_not_called()


def test_upstream_warning_does_not_retract_confirmed_publication():
    flow = _load_script("commit_flow")
    result=envelope(diagnostics=[{"message":"upstream configuration failed; remote commit confirmed"}])
    with patch.object(flow.git_state,"rev_parse",return_value=SHA), patch.object(flow.cli,"run_repocli",return_value=result):
        plan=[];flow.publish_branch(REPO,"topic",plan)
        assert plan[0].startswith("confirmed ") and plan[1].startswith("warning: upstream")


def test_missing_source_commit_never_calls_cli():
    flow = _load_script("commit_flow")
    with patch.object(flow.git_state,"rev_parse",return_value=""), patch.object(flow.cli,"run_repocli") as invoke:
        try:flow.publish_branch(REPO,"topic",[]);assert False
        except flow.SmartError:pass
        invoke.assert_not_called()


def test_foreign_commit_policy_runs_before_publication():
    from types import SimpleNamespace
    flow = _load_script("commit_flow")
    intent=SimpleNamespace(repo=REPO,target="main",explicit_base=False,mode="push")
    commits=[SimpleNamespace(oid=SHA,subject="one"),SimpleNamespace(oid="b"*40,subject="foreign")]
    with patch.object(flow.git_state,"commits",return_value=commits),patch.object(flow,"publish_branch") as publish:
        try:flow.publish(intent,flow.BranchResult("topic",True),flow.StageResult(True),[]);assert False
        except flow.SmartError as exc:assert "foreign commits" in str(exc)
        publish.assert_not_called()


if __name__ == "__main__":
    run_main(globals())

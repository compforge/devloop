"""Public Comment identities and durable Verdict joins across Forge capabilities."""
from __future__ import annotations

from dataclasses import asdict, replace
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from _testkit import _FakeForge, _load_script, run_main
from _repo_fixture import make_repo
from domain.forge import Comment, CommentResolution, ForgeOutcomeUnknown, ForgeUnsupported, PullRequest
from domain import review_feedback as feedback


def comment(identity, body, **fields):
    return Comment(id=identity, pr=7, author="reviewer", created_at="", body=body, **fields)


def finding(identity, fp, **fields):
    body = f"🤖 **devloop code-review**\n\nissue <sub>ccr:fp={fp}</sub>\n"
    body += feedback.history_marker(key=f"a.py::{fp}", msg="issue", fp=fp)
    return comment(identity, body, **fields)


def test_explicit_verdict_target_survives_grouped_replies():
    """+case=An exact child target governs pending and repeat suppression."""
    root = finding("review:root", "root", resolution=CommentResolution.RESOLVED)
    child = finding("review:child", "child", reply_to_id=root.id, resolution=CommentResolution.RESOLVED)
    verdict = comment("review:verdict", feedback.verdict_reply("repeat", "already covered", target_id=child.id),
                      reply_to_id=root.id)
    comments = [root, child, verdict]
    assert [(f.comment.id, f.verdict) for f in feedback.findings(comments)] == [
        (root.id, None), (child.id, "repeat"),
    ]
    assert feedback.suppress_delivery_fingerprints(comments) == {"child"}
    # A reload needs only Forge records, including Verdicts without a native reply edge.
    assert feedback.findings([root, child, replace(verdict, reply_to_id=None)])[1].verdict == "repeat"


def test_invalid_target_never_falls_back_to_structural_parent():
    root = finding("note:root", "root")
    bodies = [
        feedback.verdict_reply("wrong", "deleted", target_id="note:deleted"),
        feedback.verdict_reply("wrong", "self", target_id="note:reply"),
        "ccr:label=wrong <!-- ccr:target=%%% -->",
        "ccr:label=wrong <!-- ccr:target=_w -->",  # invalid UTF-8
    ]
    marker = feedback.verdict_reply("wrong", "ambiguous", target_id=root.id)
    bodies.append(marker + "\n" + marker)
    for body in bodies:
        comments = [root, comment("note:reply", body, reply_to_id=root.id)]
        assert feedback.findings(comments)[0].pending
    legacy = comment("note:reply", "ccr:label=minor — old verdict", reply_to_id=root.id)
    assert feedback.findings([root, legacy])[0].verdict == "minor"


def test_one_finding_summary_is_not_an_individual_target():
    rr = _load_script("run_review")
    body = rr._format_comment([{"path": "a.py", "content": "issue", "fingerprint": "one"}], 0, "r", "s")
    assert feedback.findings([comment("conversation:summary", body)]) == []
    assert feedback.findings([finding("conversation:individual", "one")])[0].pending


def test_label_falls_back_only_when_reply_is_unsupported():
    review = _load_script("review")
    target = finding("conversation:target", "one")
    for error in (ForgeUnsupported("no native replies"), ForgeOutcomeUnknown("response lost")):
        forge = SimpleNamespace(provider="github", list_comments=lambda number: [target])
        with patch.object(review, "_forge_or_exit", return_value=forge), \
             patch.object(forge, "reply_comment", create=True, side_effect=error) as reply, \
             patch.object(forge, "create_comment", create=True) as create:
            status = review.main(["label", "7", target.id, "wrong", "--reason", "unreachable"])
            reply.assert_called_once()
            if isinstance(error, ForgeUnsupported):
                assert status == 0
                create.assert_called_once()
                verdict = comment("conversation:verdict", create.call_args.args[1])
                assert feedback.findings([target, verdict])[0].verdict == "wrong"
            else:
                assert status == 1
                create.assert_not_called()


def test_unknown_finding_publication_does_not_retry_or_abort_review():
    """+case=An uncertain write remains visible without file/unanchored/summary redelivery."""
    rr = _load_script("run_review")
    with TemporaryDirectory() as directory:
        repo = str(make_repo(directory))
        pr = PullRequest(7, state="open", source_branch="main", target_branch="main", sha="remote-tip")
        forge = _FakeForge([pr])
        calls = []
        issue = {"path": "a.py", "end_line": 3, "content": "issue", "fingerprint": "one"}
        def create(number, body, *, anchor=None):
            calls.append((body, anchor))
            if anchor:
                raise ForgeOutcomeUnknown("response lost")
            return comment("conversation:summary", body)
        def run(*args, on_finding=None, **kwargs):
            on_finding(issue)
            return rr.review_engine.ReviewResult(ok=True, status="success", comments=[issue])
        engine = SimpleNamespace(name="ccr", available=lambda: True, configured=lambda repo: True, review=run)
        with patch.object(rr.review_engine, "resolve", return_value=engine), \
             patch.object(rr, "_open_mr", return_value=(forge, pr)), \
             patch.object(forge, "create_comment", side_effect=create):
            assert rr.main(["--repo", repo]) == 0
        assert len(calls) == 2
        assert calls[0][1].revision == rr._head_sha(repo)
        assert calls[0][1].revision != pr.sha
        assert calls[1][1] is None and "ccr:fp=one" not in calls[1][0]
        from domain.context import store
        state = store.load_segment(repo, store.branch_segment("main", "review"))
        assert state["status"] == "completed_with_warnings"
        assert state["comments"] == [issue]
        assert state["warnings"][0]["type"] == "comment_publish_unknown"


def test_all_pr_comments_reach_engine_without_filtering_or_dedup():
    """+case=People, bots, unanchored and nested replies survive unchanged; same-fingerprint comments are not collapsed."""
    import json
    from pathlib import Path
    rr = _load_script("run_review")
    old = finding("review:old", "same", url="https://example.test/pr/7#old")
    latest = replace(
        finding("review:latest", "same", url="https://example.test/pr/7#latest"),
        body="🤖 **devloop code-review**\n\n" + feedback.history_marker(
            key="a.py::same", msg="latest finding", sha="reviewed-revision", fp="same",
        ),
    )
    verdict = comment("review:verdict", feedback.verdict_reply("wrong", "unreachable", target_id=latest.id),
                      reply_to_id=latest.id)
    human = comment("conversation:human", "The same race also affects another file")
    child = comment("conversation:child", "The first fix missed the retry path", reply_to_id=human.id)
    nested = comment("conversation:nested", "Confirmed on the retry", reply_to_id=child.id)
    comments = [old, latest, verdict, human, child, nested]
    with TemporaryDirectory() as directory:
        repo = str(make_repo(directory))
        pr = PullRequest(7, state="open", source_branch="main", target_branch="main")
        forge = _FakeForge([pr])
        paths = []
        def run(repo, from_ref, to_ref, background, history_path=None, **kwargs):
            paths.append(Path(history_path))
            feed = json.loads(paths[0].read_text())
            assert feed == [asdict(c) for c in comments]
            assert [row["id"] for row in feed] == [c.id for c in comments]
            assert feed[-1]["reply_to_id"] == child.id
            return rr.review_engine.ReviewResult(ok=True, status="success", comments=[])
        engine = SimpleNamespace(name="ccr", available=lambda: True, configured=lambda repo: True, review=run)
        with patch.object(rr.review_engine, "resolve", return_value=engine), \
             patch.object(rr, "_open_mr", return_value=(forge, pr)), \
             patch.object(forge, "list_comments", return_value=comments) as fetch:
            assert rr.main(["--repo", repo]) == 0
            fetch.assert_called_once_with(7)
        assert len(paths) == 1 and not paths[0].exists()


def test_history_read_and_materialization_failures_are_visible():
    from unittest import TestCase
    from domain.forge import ForgeError
    rr = _load_script("run_review")
    pr = PullRequest(7, state="open")
    forge = _FakeForge([pr])
    with patch.object(forge, "list_comments", side_effect=ForgeError("offline")), \
         TestCase().assertLogs(rr.__name__, level="WARNING") as logs:
        assert rr._build_comment_input(forge, pr) == (None, [])
    assert "pr=7" in logs.output[0] and "offline" in logs.output[0]
    comments = [finding("review:one", "one")]
    with patch.object(forge, "list_comments", return_value=comments), \
         patch.object(rr.tempfile, "NamedTemporaryFile", side_effect=OSError("disk full")), \
         TestCase().assertLogs(rr.__name__, level="WARNING") as logs:
        assert rr._build_comment_input(forge, pr) == (None, comments)
    assert "pr=7" in logs.output[0] and "disk full" in logs.output[0]


if __name__ == "__main__":
    run_main(globals())

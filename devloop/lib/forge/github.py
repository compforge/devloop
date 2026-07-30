"""GitHubForge — the GitHub adapter for the `Forge` port.

Maps GitHub's pull-request REST surface onto the neutral domain: PR `number` (already
neutral), `/pulls` paths, `Authorization: Bearer` auth. GitHub's state model (open/closed +
a separate `merged`/`merged_at`) collapses to the neutral `open|merged|closed` here — that
normalization is exactly what this adapter exists for. The recent-window *policy* is not
here — it's `base.build_window`, composed over `recent` + `get`.
"""
from __future__ import annotations

from ._rest import RestClient
from domain.forge import Comment, Forge, ForgeError, ForgeNotFound, PullRequest, Release


class GitHubForge(Forge):
    provider = "github"

    def __init__(self, host: str, owner: str, name: str, token: str, *, timeout: int = 10):
        # github.com → api.github.com; GitHub Enterprise → https://<host>/api/v3
        api = "https://api.github.com" if host == "github.com" else f"https://{host}/api/v3"
        self.owner, self.name = owner, name
        self.c = RestClient(
            f"{api}/repos/{owner}/{name}",
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=timeout,
        )
        self._head_sha_memo: dict[int, str] = {}  # PR number → head sha（同一轮 N 条 inline 共用）

    def _to_pr(self, d: dict) -> PullRequest:
        # `merged` is only on the single-PR response; list items carry `merged_at`.
        merged = bool(d.get("merged") or d.get("merged_at"))
        gh_state = d.get("state", "")
        state = "merged" if merged else ("open" if gh_state == "open" else "closed")
        return PullRequest(
            number=int(d["number"]),
            title=d.get("title", ""),
            state=state,
            source_branch=(d.get("head") or {}).get("ref", ""),
            target_branch=(d.get("base") or {}).get("ref", ""),
            web_url=d.get("html_url", ""),
            sha=(d.get("head") or {}).get("sha", "") or "",
            updated_at=d.get("updated_at"),
        )

    def _list(self, **params) -> list[PullRequest]:
        params.setdefault("state", "all")
        params.setdefault("sort", "created")
        params.setdefault("direction", "desc")
        out = self.c.get("pulls", **params)
        return [self._to_pr(d) for d in out] if isinstance(out, list) else []

    def prs_for_branch(self, branch: str) -> list[PullRequest]:
        # `head` filter is `owner:ref`; our branches are pushed to origin (same repo).
        return self._list(head=f"{self.owner}:{branch}", per_page=20)

    def recent(self, limit: int) -> list[PullRequest]:
        return self._list(per_page=limit)

    def get(self, number: int) -> PullRequest:
        return self._to_pr(self.c.get(f"pulls/{number}"))

    def default_branch(self) -> str:
        return (self.c.get("") or {}).get("default_branch") or ""   # GET /repos/{owner}/{name}

    def description(self, number: int) -> str:
        return self.c.get(f"pulls/{number}").get("body") or ""

    def create(self, *, source_branch: str, target_branch: str, title: str,
               body: str = "") -> PullRequest:
        return self._to_pr(self.c.post("pulls", {
            "title": title,
            "head": source_branch,
            "base": target_branch,
            "body": body,
        }))

    def update(self, number: int, **fields) -> PullRequest:
        body = {}
        if "title" in fields:
            body["title"] = fields["title"]
        if "body" in fields:
            body["body"] = fields["body"]
        if "target_branch" in fields:
            body["base"] = fields["target_branch"]
        return self._to_pr(self.c.patch(f"pulls/{number}", body))

    def close(self, number: int) -> PullRequest:
        return self._to_pr(self.c.patch(f"pulls/{number}", {"state": "closed"}))

    def _to_release(self, d: dict) -> Release:
        return Release(
            tag=d.get("tag_name", ""),
            name=d.get("name") or d.get("tag_name", "") or "",
            target=d.get("target_commitish", "") or "",
            web_url=d.get("html_url", ""),
            created_at=d.get("published_at") or d.get("created_at"),
        )

    def create_release(self, *, tag: str, target: str, name: str = "", notes: str = "") -> Release:
        return self._to_release(self.c.post("releases", {
            "tag_name": tag,
            "target_commitish": target,
            "name": name or tag,
            "body": notes,
        }))

    def latest_release(self) -> Release | None:
        # /releases/latest is the newest full release (excludes drafts + prereleases) — the
        # right baseline for an increment check. 404 = no releases yet → the first release.
        try:
            return self._to_release(self.c.get("releases/latest"))
        except ForgeNotFound:
            return None

    def comments(self, number: int) -> list[Comment]:
        # GitHub splits a PR's comments across two endpoints — conversation comments live on
        # the ISSUE surface, while review roots and replies live on the PULLS surface. Group
        # review replies here so callers receive one top-level Comment per interaction.
        issue = self.c.get_all(f"issues/{number}/comments")
        review = self.c.get_all(f"pulls/{number}/comments")
        replies: dict[str, list[dict]] = {}
        roots = []
        for row in review:
            parent = str(row.get("in_reply_to_id") or "")
            if parent:
                replies.setdefault(parent, []).append(row)
            else:
                roots.append(row)

        comments = [self._to_comment(row) for row in issue]
        for root in roots:
            cid = str(root.get("id") or "")
            comment = self._to_comment(root, anchored=True)
            comment.reply_ref = cid
            comment.replies = [
                self._to_comment(row, anchored=True)
                for row in sorted(
                    replies.get(cid, []),
                    key=lambda item: item.get("created_at") or "",
                )
            ]
            comments.append(comment)
        return sorted(comments, key=lambda comment: comment.created_at)

    @staticmethod
    def _to_comment(n: dict, *, anchored: bool = False) -> Comment:
        return Comment(
            author=(n.get("user") or {}).get("login", "?"),
            body=n.get("body") or "",
            id=str(n.get("id") or ""),
            path=(n.get("path") or "") if anchored else "",
            # `line` goes null once a push makes the anchor outdated — `original_line` still
            # says where it was written, which is what a reader needs.
            line=(n.get("line") or n.get("original_line")) if anchored else None,
            created_at=n.get("created_at") or "",
        )

    def comment(
        self,
        number: int,
        body: str,
        *,
        replyable: bool = False,
        path: str = "",
        line: int | None = None,
    ) -> None:
        if not replyable:
            if path or line is not None:
                raise ForgeError(f"PR #{number}: a standalone comment cannot have a diff anchor")
            self.c.post(f"issues/{number}/comments", {"body": body})
            return
        if not path:
            raise ForgeError(f"PR #{number}: GitHub replyable comments require a diff path")
        # GitHub replyable comments live on the review surface. Anchoring lets GitHub mark
        # them outdated after later pushes; one posting round shares the current head sha.
        if number not in self._head_sha_memo:
            sha = (self.c.get(f"pulls/{number}").get("head") or {}).get("sha") or ""
            if not sha:
                raise ForgeError(f"PR #{number} has no head sha — cannot anchor a diff comment")
            self._head_sha_memo[number] = sha
        req = {"body": body, "commit_id": self._head_sha_memo[number], "path": path}
        if line is None:
            # File-level. `line`/`side` are omitted rather than nulled: the docs only say
            # line is "required unless using subject_type:file", so a null is untested
            # ground — sending no key is the shape the documented contract describes.
            req["subject_type"] = "file"
        else:
            req |= {"line": line, "side": "RIGHT"}
        self.c.post(f"pulls/{number}/comments", req)

    def reply(self, number: int, target: Comment, body: str) -> None:
        if not target.reply_ref:
            raise ForgeError(f"PR #{number}: comment {target.id or '?'} is a conversation "
                             "comment — GitHub can only reply to review comments")
        self.c.post(f"pulls/{number}/comments/{target.reply_ref}/replies", {"body": body})

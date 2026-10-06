"""Review window and presentation policy over repocli Forge objects."""
from repocli.forge.model import (
    ForgeError as ForgeError,
    ForgeAuthError as ForgeAuthError,
    ForgeNotFound as ForgeNotFound,
    PullRequestIdentity as PullRequestIdentity,
    PullRequest as PullRequest,
    CommentResolution as CommentResolution,
    Comment as Comment,
    Release as Release,
    MergeReadiness as MergeReadiness,
    Forge as Forge,
    parse_pr_number as parse_pr_number,
)

PRS_CAP = 5
_VOCAB = {"github": ("PR", "#"), "gitlab": ("MR", "!")}

def vocab(provider: str | None) -> tuple[str, str]:
    """(noun, sigil) for a provider, e.g. ('PR', '#') / ('MR', '!'). Unknown → PR/#."""
    return _VOCAB.get(provider or "", ("PR", "#"))

def pr_label(provider: str | None, number: int) -> str:
    """Forge-flavored display label, e.g. 'PR #12' / 'MR !12'. Provider is repo-level."""
    noun, sigil = vocab(provider)
    return f"{noun} {sigil}{number}"

def build_window(forge: Forge, anchor: int | None, cap: int = PRS_CAP) -> list[PullRequest]:
    """The recent-PR window: newest `cap` PRs, with the current branch's `anchor` PR always
    present (fetched if it fell off the recent list). Provider-agnostic policy composed over
    the port's `recent` + `get` primitives — one definition for every forge, regardless of
    whether its numbering is contiguous.
    """
    by_num = {p.number: p for p in forge.recent(cap)}
    if anchor is not None and anchor not in by_num:
        try:
            by_num[anchor] = forge.get(anchor)
        except ForgeNotFound:
            pass
    ordered = sorted(by_num.values(), key=lambda p: p.number, reverse=True)
    if anchor is not None and anchor in by_num and by_num[anchor] not in ordered[:cap]:
        # anchor older than the newest `cap` — keep newest cap-1 + the anchor.
        keep = [p for p in ordered if p.number != anchor][:cap - 1] + [by_num[anchor]]
        ordered = sorted(keep, key=lambda p: p.number, reverse=True)
    return ordered[:cap]

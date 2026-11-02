"""Presentation policy over repocli Forge objects."""
from repocli.forge.model import (
    ForgeError as ForgeError,
    ForgeAuthError as ForgeAuthError,
    ForgeNotFound as ForgeNotFound,
    ForgeRateLimited as ForgeRateLimited,
    PullRequestIdentity as PullRequestIdentity,
    PullRequest as PullRequest,
    CommentResolution as CommentResolution,
    Comment as Comment,
    Release as Release,
    MergeReadiness as MergeReadiness,
    Forge as Forge,
    parse_pr_number as parse_pr_number,
)

_VOCAB = {"github": ("PR", "#"), "gitlab": ("MR", "!")}

def blocks_merge(readiness: MergeReadiness) -> bool:
    """Board reminders cover actionable author work, rather than waiting/unknown states."""
    return readiness in {
        MergeReadiness.CONFLICT, MergeReadiness.DISCUSSIONS_UNRESOLVED, MergeReadiness.CI_BLOCKED,
    }


def vocab(provider: str | None) -> tuple[str, str]:
    """(noun, sigil) for a provider, e.g. ('PR', '#') / ('MR', '!'). Unknown → PR/#."""
    return _VOCAB.get(provider or "", ("PR", "#"))

def pr_label(provider: str | None, number: int) -> str:
    """Forge-flavored display label, e.g. 'PR #12' / 'MR !12'. Provider is repo-level."""
    noun, sigil = vocab(provider)
    return f"{noun} {sigil}{number}"

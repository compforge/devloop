"""Git process results supplied by repocli."""
from repocli.git import GitResult as GitResult, git as git, git_global as git_global


def operation_detail(result: GitResult) -> str:
    """Keep uncertain effects explicit at workflow error boundaries."""
    detail = result.err or result.out
    if result.uncertain:
        return f"outcome unknown; inspect Git state before retrying: {detail}"
    return detail

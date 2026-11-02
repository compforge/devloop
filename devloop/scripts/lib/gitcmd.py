"""Git process results supplied by repokit."""
from repokit.git import GitResult as GitResult


def operation_detail(result: GitResult) -> str:
    """Keep uncertain effects explicit at workflow error boundaries."""
    detail = result.err or result.out
    if result.uncertain:
        return f"outcome unknown; inspect Git state before retrying: {detail}"
    return detail

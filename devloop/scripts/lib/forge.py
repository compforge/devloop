"""SDK access for operations not exposed by repocli; no devloop credentials or endpoints."""
from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from repokit.config import load_config
from repokit.forge.model import Forge, ForgeError
from repokit.git.remote import remote


def forge_client(repo_dir: str | Path, *, timeout: int = 10) -> Forge | None:
    """Comments, releases and repository metadata currently require the native SDK."""
    origin = remote(repo_dir)
    if origin is None:
        return None
    try:
        connection = replace(load_config().forge(origin.host), timeout=timeout)
        return connection.client(origin.path)
    except (ValueError, OSError) as error:
        raise ForgeError(str(error)) from error

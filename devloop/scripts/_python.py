# /// script
# requires-python = ">=3.11"
# dependencies = ["compforge-repocli @ git+https://github.com/compforge/repocli.git@3de611a08fab462259c6e91b9a0f6c48476d08dd#subdirectory=toolkit/python"]
# ///
"""Keep workflow dependencies in uv's locked script environment, outside user repos."""
import os
import sys

# exec preserves Python's argument, cwd, stdin and exit-code contracts. The cached
# script environment also survives the parent command for detached workflow jobs.
os.execv(sys.executable, [sys.executable, *sys.argv[1:]])

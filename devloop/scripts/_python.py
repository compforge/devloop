# /// script
# requires-python = ">=3.11"
# dependencies = ["compforge-repocli @ git+https://github.com/compforge/repocli.git@46cb35b17e1479e3b8c4a32d10dcbd61ef4ee090#subdirectory=toolkit/python"]
# ///
"""Keep workflow dependencies in uv's locked script environment, outside user repos."""
import os
import sys

# exec preserves Python's argument, cwd, stdin and exit-code contracts. The cached
# script environment also survives the parent command for detached workflow jobs.
os.execv(sys.executable, [sys.executable, *sys.argv[1:]])

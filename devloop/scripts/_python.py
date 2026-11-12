# /// script
# requires-python = ">=3.11"
# dependencies = ["compforge-repokit @ git+https://github.com/compforge/repokit.git@34faebf7ee750faa299418e953e32f632486cac3#subdirectory=toolkit/python"]
# ///
"""Keep workflow dependencies in uv's locked script environment, outside user repos."""
import os
import sys

# exec preserves Python's argument, cwd, stdin and exit-code contracts. The cached
# script environment also survives the parent command for detached workflow jobs.
os.execv(sys.executable, [sys.executable, *sys.argv[1:]])

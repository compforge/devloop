# /// script
# requires-python = ">=3.11"
# dependencies = ["compforge-repocli @ git+https://github.com/compforge/repocli.git@ae420ff3ebc2f67a2c13557ae7cf2b109103b509#subdirectory=toolkit/python"]
# ///
"""Keep workflow dependencies in uv's locked script environment, outside user repos."""
import os
import sys

# exec preserves Python's argument, cwd, stdin and exit-code contracts. The cached
# script environment also survives the parent command for detached workflow jobs.
os.execv(sys.executable, [sys.executable, *sys.argv[1:]])

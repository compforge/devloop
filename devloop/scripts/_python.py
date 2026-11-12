# /// script
# requires-python = ">=3.11"
# dependencies = ["compforge-repokit @ git+https://github.com/compforge/repokit.git@a8338acc4527bde25205436a5851f56d27c348b4#subdirectory=toolkit/python"]
# ///
"""Keep workflow dependencies in uv's locked script environment, outside user repos."""
import os
import sys

# exec preserves Python's argument, cwd, stdin and exit-code contracts. The cached
# script environment also survives the parent command for detached workflow jobs.
os.execv(sys.executable, [sys.executable, *sys.argv[1:]])

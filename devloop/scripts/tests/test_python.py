#!/usr/bin/env python3
"""The shipped launcher owns its dependencies without touching the target environment."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory

from _testkit import SCRIPTS, run_main


def test_locked_launcher_is_isolated_readonly_and_reusable_offline():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        plugin = root / "plugin"
        target = root / "target"
        plugin.mkdir()
        target.mkdir()
        for name in ("python", "_python.py", "_python.py.lock"):
            shutil.copy2(SCRIPTS / name, plugin / name)
            (plugin / name).chmod(0o555 if name == "python" else 0o444)
        plugin.chmod(0o555)
        (target / "pyproject.toml").write_text('[project]\nname="hostile"\nversion="0"\nrequires-python="<3.11"\n')
        (target / "uv.toml").write_text("not valid TOML [[[")
        (target / ".python-version").write_text("3.10")
        active = target / ".venv"
        (active / "bin").mkdir(parents=True)
        (active / "bin/python").write_text("#!/bin/sh\nexit 99\n")
        (active / "bin/python").chmod(0o755)
        env = dict(os.environ, VIRTUAL_ENV=str(active), UV_PROJECT_ENVIRONMENT=str(target / "trap"), UV_OFFLINE="1")
        code = """import json, os, sys
from importlib.metadata import version
import repocli
print(json.dumps(dict(version=version('compforge-repocli'), cwd=os.getcwd(),
    args=sys.argv[1:], stdin=sys.stdin.read(), prefix=sys.prefix, executable=sys.executable)))
"""
        before = {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}
        try:
            command = [str(plugin / "python"), "-c", code, "space argument", "--flag"]
            observations = []
            for _ in range(2):
                result = subprocess.run(command, cwd=target, env=env, input="payload", text=True,
                                        capture_output=True, check=True)
                observations.append(json.loads(result.stdout))
            first = observations[0]
            # uv may invoke python on creation and python3 on reuse; the environment is stable.
            assert {k: v for k, v in first.items() if k != 'executable'} == {
                k: v for k, v in observations[1].items() if k != 'executable'}
            assert first['version'] == '0.2.5'
            assert Path(first['cwd']).resolve() == target.resolve()
            assert first['args'] == ['space argument', '--flag'] and first['stdin'] == 'payload'
            executable = Path(first['executable'])
            assert executable.is_file() and not executable.is_relative_to(target)
            # Detached jobs must still import their dependencies after the launcher exits.
            subprocess.run([str(executable), '-c', 'import repocli'], check=True)
            failure = subprocess.run([str(plugin / 'python'), '-c', 'raise SystemExit(7)'], cwd=target, env=env)
            assert failure.returncode == 7
            after = {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}
            assert after == before and not (target / 'trap').exists()
        finally:
            plugin.chmod(0o755)


def test_missing_uv_has_actionable_error():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        # Keep the shell's directory utility available while making uv unavailable.
        (root / 'dirname').symlink_to(shutil.which('dirname'))
        result = subprocess.run([str(SCRIPTS / 'python'), '-c', 'pass'],
                                env=dict(os.environ, PATH=str(root)), text=True, capture_output=True)
        assert result.returncode == 127 and 'uv is required' in result.stderr


if __name__ == '__main__':
    run_main(globals())

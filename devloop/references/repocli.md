# repocli

Use repocli directly to inspect repository changes. It reports changed source files,
symbols and potentially affected test files; devloop owns check execution and stamps.
There is no separate repocli skill or Python forwarding script.

```sh
repocli --version
repocli diff --help
repocli diff --repo /path/to/repo --base HEAD --impact file --test-dir . --json
repocli diff --repo /path/to/repo --base HEAD^ --head HEAD --impact file --test-dir . --json
```

Use the installed command's help as the flag reference. `--base` is an exact ref;
compute the merge base explicitly when inspecting a branch. `--head` selects a
commit, `--staged` selects the index, and the default includes staged, unstaged and
non-ignored untracked files. Repeat `--changed-file` to restrict changed seeds while
retaining the full dependency graph. Use `--impact file` for conservative import
propagation; symbol mode can miss calls between declarations in the same file.

## Validation

Normally call `run_validate.py`, `run_lint.py`, or `run_tests.py` without file lists.
Do not have the agent guess `TEST_FILES` or `LINT_FILES`, and do not pass empty file
arguments as boilerplate. The workflow normalizes first, calls repocli once per
transaction, maps repository paths to Components, then invokes project targets.
Cross-Component dependent tests expand repository-level validation; explicitly
targeting a Component retains that boundary. Full fallback includes all discovered
Components for a repository request.

The pre-commit input is the working tree restricted to the intended changed paths;
post-commit uses `HEAD^` versus `HEAD`; MR checks use target merge-base versus `HEAD`.
If execution contents differ from the committed target, use full checks. Missing
CLI, timeout, invalid/incompatible JSON, uncertain impact, deleted/unsafe paths or
unsupported project file-list contracts also select canonical full checks. Board
shows the latest scope and reason. Check failures remain failures; they never
trigger a second full run under the label of analysis fallback.

`--full` explicitly requests full checks. Focused or explicit narrow runs never
grant a full Component stamp. Empty test selections conservatively run full tests.
Full checks clear inherited file-list variables. Custom arguments after `--` remain
an advanced override; target one Component and report the scope accurately.

## Installation and compatibility

Install a fixed repocli release from [GitHub releases](https://github.com/compforge/repocli/releases)
outside validation, verify its published SHA-256 checksum, and put its binary on
`PATH`. `DEVLOOP_REPOCLI=/absolute/path/repocli` selects another installed binary.
No validation workflow downloads, upgrades or compiles repocli.

This integration requires JSON `schemaVersion: 2`, `impactMode: file`, a complete
report, and a snapshot identity. Older binaries safely fall back to full checks.
The schema-2 release must be installed after its repocli PR is merged and released;
until then a locally built binary can be selected explicitly for development.
The content digest identifies observed input, not an atomic filesystem snapshot or
proof of test coverage. Repocli diagnostics remain static-analysis estimates.

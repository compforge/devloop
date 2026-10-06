# repocli

Use repocli directly to inspect repository changes. It reports changed source files,
symbols and potentially affected files; devloop owns check execution and stamps.
There is no separate repocli skill or Python forwarding script.

```sh
repocli --version
repocli inspect --repo /path/to/repo --json
repocli snapshot --repo /path/to/repo --json
repocli diff --help
repocli diff --repo /path/to/repo --base HEAD --test-dir . --json
repocli diff --repo /path/to/repo --base HEAD^ --head HEAD --test-dir . --json
```

Use the installed command's help as the flag reference. `--base` is an exact ref;
compute the merge base explicitly when inspecting a branch. `--head` selects a
commit, `--staged` selects the index, and the default includes staged, unstaged and
non-ignored untracked files. Repeat `--changed-file` to restrict changed seeds while
retaining the dependency workset. Repocli selects symbol, file or package granularity
automatically. `affectedFiles` includes seeds, confidence, distance and relation evidence;
these describe static associations, not runtime probabilities.

## Organization

`inspect` supplies the Component catalog, language and package-tool metadata.
The TypeScript runtime calls native `@compforge/repocli` `inspect` and `owner`; it does
not invoke the CLI or decode its JSON protocol. Python workflows continue using the CLI.
Devloop retains execution containment, command selection, environment preparation,
validation gates and stamps.

Each policy operation shares one inspection promise per checkout, including in-flight
work and rejection. A new operation observes fresh metadata. Ownership and validation
selection project that explicit catalog without another inspection; `owner` includes
deleted paths. Configure repository boundaries
in `.repocli.json`; fixture manifests such as `testdata/corpus/go.mod` are not independent
Components unless the repository explicitly declares them. Submodule contents belong to
their own repository inspection; a parent gitlink remains a parent-repository change.

Inspection is required for validation even with `--full`: failure stops validation and
reports the dependency problem. It never produces a fabricated root Component or an
empty successful workset. Optional Board metadata can be unavailable while Git/review
state is still displayed. Environment preparation reports an inspection warning.

## Validation

Normally call `run_validate.py`, `run_lint.py`, or `run_tests.py` without file lists.
Do not have the agent guess `TEST_FILES` or `LINT_FILES`, and do not pass empty file
arguments as boilerplate. The workflow normalizes first, calls repocli once per
transaction for dependency analysis, maps repository paths through the inspect catalog to Components, then invokes project targets.
Cross-Component dependent tests expand repository-level validation; explicitly
targeting a Component retains that boundary. Full fallback includes all discovered
Components for a repository request.

The pre-commit input is the working tree restricted to the intended changed paths;
post-commit uses `HEAD^` versus `HEAD`; MR checks use target merge-base versus `HEAD`.
If execution contents differ from the committed target, use full checks. Failed diff analysis, timeout, invalid/incompatible diff JSON, deleted/unsafe paths or unsupported project
file-list contracts also select canonical full checks. A successful valid report
supplies the files even when its scope is `partial`, `complete` is false, or it
has diagnostics. Dependency gaps remain visible in the selection reason and do
not widen lint or test scope. Local extraction `observations` likewise do not downgrade
checks. Devloop uses `affectedFiles` for lint and `testFiles` for tests, without applying
a separate confidence or distance cutoff. Board
shows the latest scope and reason. Check failures remain failures; they never
trigger a second full run under the label of analysis fallback.

`--full` explicitly requests full checks. Focused or explicit narrow runs never
grant a full Component stamp. A valid empty file list skips the corresponding
Component check without updating its stamp, including for partial reports. A missing or
invalid list is an unusable result and triggers full fallback. Empty selections do not
prove runtime independence. Explicitly passing `TEST_FILES=` requests full tests.
Full checks clear inherited file-list variables. Custom arguments after `--` remain
an advanced override; target one Component and report the scope accurately.

## Installation and compatibility

Install a fixed repocli release from [GitHub releases](https://github.com/compforge/repocli/releases)
outside validation, verify its published SHA-256 checksum, and put its binary on
`PATH`. `DEVLOOP_REPOCLI=/absolute/path/repocli` selects another installed binary for
Python workflows and has no effect on the native TypeScript runtime.
No validation workflow downloads, upgrades or compiles repocli.

Use repocli 0.11.0 or later: inspect schema 1, snapshot schema 2, and diff schema 3.
Diff requires valid file lists,
and a matching snapshot identity. Dependency analysis may be incomplete. An unsupported
diff schema falls back to full checks and reports the required version.
The content digest identifies observed input, not an atomic filesystem snapshot or
proof of test coverage. Repocli diagnostics remain static-analysis estimates.

## Execution identity and reporting

Validation obtains content identity through `repocli snapshot --json` (snapshot
schema 2), including captured internal symlinks and initialized submodules with dirty contents.
The workflow does not reproduce the digest algorithm in Python. Missing, invalid
or incomplete snapshots permit full checks but never grant a validation stamp;
the reason is shown separately from the check result. An initial complete identity
must still match before and after execution.

Selection/fallback reasons remain in the scope lines and Board. Check summaries
report command outcomes; selection reasons appear as separate guidance so a full
check failure is not presented as a repocli execution error. Snapshot completeness
verifies captured input; dependency-analysis completeness describes blocking input,
workset and repository-resolution gaps, while local observations retain extraction limits. A
partial dependency report can select tests only while the input identity still matches.

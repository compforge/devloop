# repocli

Use repocli directly to inspect repository changes. It reports changed source files,
symbols and potentially affected files; devloop owns check execution and stamps.
There is no separate repocli skill or Python forwarding script.

```sh
repocli --version
repocli inspect --repo /path/to/repo --json
repocli snapshot --repo /path/to/repo --json
repocli impact --help
repocli impact --repo /path/to/repo --base HEAD --json
repocli impact --repo /path/to/repo --base HEAD^ --head HEAD --json
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
TypeScript uses `@compforge/repocli`; Python uses `compforge-repocli`. Both call native
`inspect` and `owner`, sharing the toolkit contract rather than the CLI JSON protocol.
Devloop retains execution containment, command selection, dependency preparation timing,
validation gates and stamps.

Each TypeScript policy operation shares one inspection promise per checkout, including in-flight
work and rejection. Python selection passes one explicit catalog through the operation.
A new operation observes fresh metadata. Ownership and validation
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
arguments as boilerplate. The workflow normalizes first and calls repocli once per
transaction. General `impact` analysis, without `--test-dir`, reports affected Components,
including downstream Components that have no discovered tests. `--test-dir` narrows the
analysis around test candidates and is not the mode for Component selection.

Devloop consumes `components` directly: `affected=true` selects a Component; `complete=false`
selects it conservatively because its impact is unknown. Complete, unaffected Components are
omitted. Before-only records retain deleted/previous ownership as evidence, but are not current
execution directories. Explicitly targeting a Component retains that boundary.
Each selected Component runs its canonical full lint and test targets, regardless of `testFiles`.
The inspect catalog supplies execution metadata; devloop does not infer dependencies from paths.

The pre-commit input is the working tree restricted to intended changed paths;
post-commit uses `HEAD^` versus `HEAD`; MR checks use target merge-base versus `HEAD`.
If execution contents differ from the analyzed snapshot, or the report is unavailable,
incompatible or inconsistent with the current catalog, validation falls back to all current
Components (or the explicit Component). Diagnostics and per-Component gaps remain visible on Board.
Local extraction observations do not independently expand selection. Check failures stay failures
and never trigger a second run under the label of analysis fallback.

`--full` bypasses impact selection and validates all requested Components. A valid selection with
no affected or unknown Components skips checks without stamps. This is a static-analysis result,
not proof of runtime independence. Full checks clear inherited file-list variables and can stamp
successful Component checks. Explicit arguments after `--` remain an advanced override: target one
Component and report the scope accurately. Narrowed runs never grant a full Component stamp;
passing only `TEST_FILES=` under the project's Make contract requests the full suite.

## Installation and compatibility

Python entrypoints run through `<PLUGIN_ROOT>/scripts/python`. Its PEP 723 script
declares a compatible toolkit version range; the adjacent lockfile records the resolved
toolkit and transitive versions used for validation. uv owns the cached script environment,
outside both the plugin installation and the inspected repository;
it does not select the target project's virtual environment or uv configuration.
Python 3.11+ and uv are required. `DEVLOOP_PYTHON` selects a compatible interpreter.
Warm the environment before offline work:

```sh
<PLUGIN_ROOT>/scripts/python -c 'import repocli'
```

Refresh within the declared range with
`uv lock --script devloop/scripts/_python.py --upgrade-package compforge-repocli`.
For the TypeScript library, use `npm update @compforge/repocli` in the plugin directory.
Validate the resulting dependencies before committing either lockfile. Keep the Python
lockfile in both Git and the npm package.


Install a compatible stable repocli release from [GitHub releases](https://github.com/compforge/repocli/releases)
outside validation, verify its published SHA-256 checksum, and put its binary on
`PATH`. `DEVLOOP_REPOCLI=/absolute/path/repocli` selects another installed binary for
Python diff analysis; organization inspection does not use this setting.
No validation workflow downloads, upgrades or compiles the repocli CLI.

Use repocli CLI 0.24.0 or later for Component impact flags and the shared
content-identity contract (impact schema 3). The installed CLI is not pinned to a devloop release;
newer compatible releases are accepted. CLI and library versions are independent.

On CLI versions providing self-upgrade, use `repocli upgrade --check` (or add `--json`)
to discover updates and `repocli upgrade` to install the latest stable release.
Older installations can bootstrap from GitHub releases. Package-manager-owned
installations should use that package manager's upgrade command. Updating the CLI
does not update the TypeScript/Python libraries or their lockfiles.
Impact requires a complete current Component catalog, valid impact flags and file lists,
and a matching snapshot identity. Dependency analysis may be incomplete. An unsupported
diff schema falls back to full checks and reports the required version.
The content digest identifies observed input, not an atomic filesystem snapshot or
proof of test coverage. Repocli diagnostics remain static-analysis estimates.

## Execution identity and reporting

Validation obtains content identity through the native toolkit, including captured
internal symlinks and initialized submodules with dirty contents. The workflow does
not reproduce the digest algorithm. Missing, invalid
or incomplete snapshots permit full checks but never grant a validation stamp;
the reason is shown separately from the check result. An initial complete identity
must still match before and after execution.

Selection/fallback reasons remain in the scope lines and Board. Check summaries
report command outcomes; selection reasons appear as separate guidance so a full
check failure is not presented as a repocli execution error. Snapshot completeness
verifies captured input; dependency-analysis completeness describes blocking input,
workset and repository-resolution gaps, while local observations retain extraction limits. A
partial dependency report can select Components only while the input identity still matches.

Repository operations and working-tree content identities use the native toolkit. Python workflows
consume compforge-repocli; TypeScript hooks consume @compforge/repocli. Only impact analysis uses the
Go CLI. Content identity is shared by validation execution and the commit gate.

`repocli diff` is a standalone captured-change view; validation consumes `repocli impact`.
Unit formation is a separate repository capability and is not part of devloop test selection.

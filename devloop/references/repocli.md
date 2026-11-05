# repocli

Use repocli directly to inspect repository changes. It reports changed source files,
symbols and potentially affected files; RepoKit also owns validation execution and history.
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
TypeScript uses `@compforge/repokit`; Python uses `compforge-repokit`. Both call native
`inspect` and `owner`, sharing the toolkit contract rather than the CLI JSON protocol.
Devloop retains workflow boundaries and managed-worktree preparation timing.

Each TypeScript policy operation shares one inspection promise per checkout, including in-flight
work and rejection. Python preparation passes one explicit catalog through the operation.
Validation planning and Makefile execution are owned by the Go CLI.
A new operation observes fresh metadata; `owner` includes
deleted paths. Discovery prefers manifests, then Makefiles with unknown language. No
repocli-specific repository configuration is needed. Fixture manifests such as
`testdata/corpus/go.mod` are not independent Components. Submodule contents belong to
their own repository inspection; a parent gitlink remains a parent-repository change.

Inspection is required for preparation and full/fallback validation: failure stops validation and
reports the dependency problem. It never produces a fabricated root Component or an
empty successful workset on failure. A successful inspection with zero Components is a valid
repository: validation is skipped without execution or passing stamps. Optional Board metadata can be unavailable while Git/review
state is still displayed. Environment preparation reports an inspection warning.

## Validation

Use `repocli format/lint/test` independently or `repocli validate --check format,lint,test`
for a combined round. `--base` selects impact-based checks; without it selected
Components run full checks. `--plan` is read-only. The Go toolkit owns Makefile
parsing, plans, bounded execution, Component/check fingerprints and result reuse.

The AI selects scope and runs the CLI directly; devloop does not wrap it in Python or
execute validation from commit hooks. Inspect the report before publishing code. See
[validation](../skills/validate/SKILL.md) and [repository-toolkit](../docs/repository-toolkit.md).

## Installation and compatibility

Python entrypoints run through `<PLUGIN_ROOT>/scripts/python`. Its PEP 723 script
declares a compatible toolkit version range; the adjacent lockfile records the resolved
toolkit and transitive versions used for validation. uv owns the cached script environment,
outside both the plugin installation and the inspected repository;
it does not select the target project's virtual environment or uv configuration.
Python 3.11+ and uv are required. `DEVLOOP_PYTHON` selects a compatible interpreter.
Warm the environment before offline work:

```sh
<PLUGIN_ROOT>/scripts/python -c 'import repokit'
```

Update the pinned PyPI version in `devloop/scripts/_python.py`, then run
`uv lock --script devloop/scripts/_python.py`.
For the TypeScript library, use `npm update @compforge/repokit` in the plugin directory.
Validate the resulting dependencies before committing either lockfile. Keep the Python
lockfile in both Git and the npm package.


Install a compatible stable repocli release from [GitHub releases](https://github.com/compforge/repokit/releases)
outside validation, verify its published SHA-256 checksum, and put its binary on
`PATH`. Use repocli CLI 0.57.1 or later. The AI may invoke another installed binary by
absolute path. Native toolkit operations do not require the CLI and never download or build it.
Python and TypeScript toolkit dependencies remain independently locked.

On CLI versions providing self-upgrade, use `repocli upgrade --check` (or add `--json`)
to discover updates and `repocli upgrade` to install the latest stable release.
Older installations can bootstrap from GitHub releases. Package-manager-owned
installations should use that package manager's upgrade command. Updating the CLI
does not update the TypeScript/Python libraries or their lockfiles.
## Execution identity and reporting

Keep the original ValidationReport, including scope, diagnostics, command outputs,
inputsConsistent and per-check results. A nonzero check exit may still return a valid
JSON report; protocol/launch failures remain errors. Repocli decides reuse eligibility.
The AI reports the CLI result; devloop does not import it into a commit gate. Repository snapshots used by Git
staging still come from the native toolkit and share the CLI's content contract.

PR operations require repocli >= 0.57.1; Python RepoKit no longer provides a CLI runtime.

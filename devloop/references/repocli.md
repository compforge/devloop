# repocli

Use repocli directly to inspect repository changes. It reports changed source files,
symbols and potentially affected files; RepoKit also owns validation execution and history.
Skills invoke the CLI directly. Programmatic PR queries share a bounded result decoder;
it owns no credentials, retry policy or repository state.

```sh
repocli version --json
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
automatically. `data.affectedFiles` includes seeds, confidence, distance and relation evidence;
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

The AI selects validation scope and runs the CLI directly; commit hooks do not execute validation.
Automated repository queries prefer the CLI; SDKs cover operations without an equivalent CLI contract. Inspect the report before publishing code. See
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
`PATH`. Use repocli CLI 0.69.0 or later with output schema `"1.0"`. The AI may invoke another installed binary by
absolute path. Native toolkit operations do not require the CLI and never download or build it.
Python and TypeScript toolkit dependencies remain independently locked.
The shared user directory is explicit `home` / CLI `--home`, then `REPOKIT_HOME`, then `~/.repokit`.
Devloop uses the toolkit default and never supplies its `.devloop` workflow directory as RepoKit home.

Use `repocli upgrade --check` (or add `--json`)
to discover updates and `repocli upgrade` to install the latest stable release.
Older installations can bootstrap from GitHub releases. Package-manager-owned
installations should use that package manager's upgrade command. Updating the CLI
does not update the TypeScript/Python libraries or their lockfiles.

## Command results and recovery

Before using CLI output to decide the next workflow action, read this contract. Use `--json`
for validation and PR/cleanup decisions. stdout contains one final command result; stderr
contains progress and logs. Capture the exit status and parse stdout even on nonzero exit.
`version --json` reports the product version at `data.version`; help and `--version` remain text.

The envelope has `schemaVersion`, `command`, `outcome`, `summary`, `diagnostics`, `data`,
`artifacts` and `cost`, plus `error` when the command cannot complete. Check schema `"1.0"`
and the expected command before interpreting `data`. Native SDKs return domain objects;
they do not return this envelope. Domain schema versions inside `data` are independent.
An unsupported schema, unknown outcome, missing or malformed result cannot authorize the
next workflow step; report the protocol failure. Do not fall back to the old raw report shape.

| Outcome | Workflow decision |
|---|---|
| `succeeded` | Check domain coverage and diagnostics before accepting evidence or proceeding. |
| `failed` | Preserve available `data` and diagnose the failed step before retrying. |
| `partial` | Report confirmed successes and remaining failures separately; do not replay completed actions. |
| `unknown` | Reconcile the target's current state before deciding whether to retry a write. |

Exit codes are 0 for command success, 1 for execution/domain failure or unknown results,
and 2 for argument errors. Exit status and result must agree; neither a parseable object nor
an exit code alone proves completion. `data: null` means no available result; `data: []` means
a known empty collection only after a successful query. Analysis can succeed with
`data.complete: false`; inspect its gaps without inventing a full-validation fallback.

Use `error.code` for classification and `op`, `subject`, `httpStatus`, `retryAt`, `uncertain`
and `hint` for context. `error` is optional: failed checks and partial batches can be fully
explained by `data` and diagnostics. Do not parse `message` or `summary` for control decisions.
Diagnostics carry severity/code/phase and may link evidence via a JSON Pointer into the
whole result (for example `/data/components/0/checks/1`). Preserve these links and any
successfully exported artifacts when reporting a failure.

`error.uncertain: true`, `outcome: unknown`, or interrupted output after a write requires
observation of the same repository, branch and target identity. A timeout/network code alone
never makes a write safe to retry. Honor an available `retryAt` before another remote attempt;
resolve authentication, access or argument problems at their source. Missing output must not
be interpreted as absence of side effects. PR-specific recovery is in
[PR management](../skills/git-ops/references/pr-management.md).

`--output <file>` on validation saves the whole command result, including failed rounds,
plans and history. Successful export matches JSON stdout, not the raw ValidationReport;
`artifacts` identifies the exported file. Keep reports in ignored local state: they contain
project output, and the caller owns retention. Export failure does not erase checks already
completed in `data`, but must be reported separately. Do not rerun checks solely to reconstruct
an export. Repocli owns execution identity and reuse; devloop does not import this result
into a commit gate or maintain another validation cache.

## Cost reporting

All durations are seconds. Report `cost.wallSeconds` as this invocation's elapsed time,
then use measured `cost.phases` and `cost.validation.steps` to identify expensive work.
For validation, report Component/check, scope, status, executed/reused, `executionSeconds`
and `lookupSeconds`; include the slowest steps and the result artifact when available.

`cost.validation.executionSeconds` and `lookupSeconds` are sums across checks, which may
run concurrently. A reused check has zero current execution cost; its historical
`data` check `durationSeconds` is not charged again. Zero cost alone does not prove a check ran
or passed. History totals belong to `data`, not this invocation's cost. Do not add parent
phases to their checks, subtract summed work from wall time to infer CLI overhead, or
invent timings for unmeasured lock/scan work. `wallSeconds` ends before final serialization
and output delivery. See [validation](../skills/validate/references/spec.md) for acceptance.

## Repository access

RepoKit owns Forge instance/provider, API host and credentials in `<home>/config.json`.
Devloop does not load access settings or inject token environment variables. SDK fallbacks use
RepoKit configuration; workflow configuration only selects the PR target repository.
The configured access contract requires Python RepoKit 0.26.0 and TypeScript RepoKit 0.20.0.

## Discussions

Skills invoke `repocli pr discussion` directly for list/show/create/reply/resolve; there is no
Python PR command wrapper. See [PR management](../skills/git-ops/references/pr-management.md#discussions)
for opaque IDs, platform capabilities and recovery. Review Verdicts and fix authorization remain
in devloop's review workflow; its SDK-backed execution is independent of the generic CLI entrypoints.

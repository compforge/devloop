# Component validation contract

The project declares literal targets in each Component's Makefile:

- `format`: optional source normalization, explicitly requested before checks.
- `lint-ci`, then `lint`: static checks.
- `test`, then `test-ci`, then `test-local`: behavior checks.

Repocli parses this contract without evaluating Make, freezes commands and uses
`make -f Makefile`. It does not infer language-specific runners. The project owns
whether recipes perform meaningful checks and their internal resource budgets.

## Focused static quality

`LINT_FILES` and `TEST_FILES` are optional space-delimited Component-relative paths.
An empty value must mean the complete check. Repocli selects focused inputs only
when the corresponding variable is explicitly consumed and paths are representable.
Deleted/reowned paths, missing filtering support or empty candidates for an affected
Component fall back to full scope. Partial impact does not by itself force full scope.

## Execution and evidence

`repocli format`, `lint`, `test` are independent. `validate` defaults to lint/test;
`validate --check format,lint,test` finishes format before fresh planning and bounded parallel
checks. Failed format stops the round; absent optional format allows checks. Format-only
success is never lint/test evidence. Dependencies must be prepared first.

The CLI command envelope and the ValidationReport in `data` answer different questions:
command completion versus validation coverage and evidence. Read
[the shared result contract](../../../references/repocli.md#command-results-and-recovery).

| Evidence | Acceptance |
|---|---|
| Exit 0, `outcome: succeeded`, `data.passed`, `data.complete`, `data.inputsConsistent` all true | Accept only the reported check scope; focused success is not full coverage. |
| A check failed, even without a top-level `error` | Report its diagnostics/output and repair the failure; preserve other check results. |
| `inputsConsistent: false` | Passing checks do not validate the current inputs. |
| Missing targets, skipped or unavailable checks | Describe the uncovered checks; do not call them passing. |
| Plan or history result | Planning/prior evidence only; not a newly executed validation round. |
| Successful checks but output export failed | Preserve the checks and report the export failure separately. |

Check `data.components[].checks[].scope` and individual results even when all report flags are true.
Format-only success is not validation coverage. Partial analysis alone does not mandate
full checks: RepoKit selects the scope and explains fallback. Cost is reported from the
current command's `cost`, with reuse accounting defined in
[cost reporting](../../../references/repocli.md#cost-reporting).

Repocli owns persistent execution history and checks reuse using Component/check inputs, command,
scope, environment and dependency receipts. The AI inspects this report before publishing code;
devloop does not import it into a commit gate or maintain a second reuse cache.

See [repository-toolkit](../../../docs/repository-toolkit.md) for CLI/toolkit ownership
and skill-led validation. An unsupported CLI contract stops validation;
it does not trigger a second Make runner or a historical-protocol fallback.

## History diagnosis

Use a live checkout to identify the Repository. List retained executions, then inspect a run:

```sh
repocli validate history list --repo <repo> --check test --status failed --limit 20 --json
repocli validate history list --repo <repo> --component <root> --checkout <checkout-path> --json
repocli validate history show <runID> --repo <repo> --json
```

The default list spans all of that Repository's checkouts. `--checkout` matches an exact historical
path, including a removed worktree; `--component` is a repository-relative root (`.` for the root).
Omit `--status` when investigating slow checks regardless of success. Lists are newest first,
not slowest first; use `data.total`, `data.hasMore` and `--offset` to navigate the retained records.
Each actual execution appears once; reuse updates its counters without creating another execution.
`repocli validate --history` provides aggregate statistics.

In detail, `data.run` identifies checkout, Component/check, scope, status and input consistency;
`data.result` contains the original command, file scope, captured stdout/stderr and `testTimings`.
Use those timings to locate slow cases and compare focused selections. Parent/child timings and
parallel tests can overlap, so do not sum them as wall time. `data.inputs` supplies snapshot and
file digests; it does not expose source contents or environment values. JSON preserves the captured
output; text shows bounded excerpts. Use `--output <file>` to retain the result when needed.

A successful query can contain a failed historical check. Detail `data.complete` means evidence
availability, not passing validation. On `partial`, keep the available run and report diagnostics
for missing evidence. A missing run or a failed store read is not a successful empty history.
`unfinished` means no completion event was retained; it does not prove the process is still running.

Report historical execution from `data.run.durationSeconds` and result timings, separately from
this query's `cost.wallSeconds` and `history.query` phase. Completion events are recorded after
input verification, so subtracting run timestamps does not measure check execution.
History informs diagnosis; RepoKit still decides reuse during normal validation of current inputs.

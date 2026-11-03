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

The report distinguishes inputsConsistent, complete and passed. Missing targets are
unavailable; failed commands remain failed. Input changes invalidate passing evidence
independently of check availability. A focused pass does not grant full coverage.

Repocli owns persistent execution history and checks reuse using Component/check inputs, command,
scope, environment and dependency receipts. Devloop stores reports and branch references,
then applies lifecycle policy. It never compares Python/Node host environments.

See [repository-toolkit](../../../docs/repository-toolkit.md) for input declarations,
report association and gate ownership. An unsupported CLI contract stops validation;
it does not trigger a second Make runner or a historical-protocol fallback.

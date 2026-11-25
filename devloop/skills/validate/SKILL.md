---
name: validate
description: Use to validate changes before publishing, set up Makefile checks, or diagnose failed or slow checks with repocli.
---

## Validate a change

Prepare dependencies using the project's setup instructions. From the repository root, run
`repocli validate`. It runs lint and unit tests for the changes on your branch. Repocli selects
affected files and falls back to a full Component check when it cannot determine the scope.

Request a build when you need to verify that the code compiles or packages successfully.
Request full checks when the task requires full coverage. Use `repocli validate --help` for options.

Before publishing, finish all edits and keep the checkout unchanged during validation. Read the
result for each Component. Report which checks ran or were reused, what they covered, and any
failures or skipped checks. Accept the reported scope when validation passed, completed, and
verified that its inputs stayed unchanged.

For a failed or slow check, inspect its [recorded output and timings](references/spec.md#history-diagnosis).
Use the slowest step to decide [what to tune](references/spec.md#capacity-tuning).

## Set up a Component

A Component declares its checks in its own Makefile. Use the project's existing tools.
`format` updates source files, `lint` checks them, and `test` runs unit tests independently of
`build`. Add `build` when there is an artifact to compile or package. Lint, test and build can
run concurrently.

See the [Makefile contract](references/spec.md) and the [Go](references/go.md),
[Python](references/python.md), or [Node](references/node.md) guide for recipe examples.

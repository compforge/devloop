# Component validation contract

## Validation pipeline

Validation belongs to a Component and consists of preparation followed by multiple checks:

```text
normalize: make fix
        ↓
stable Component content
   ├─ static quality: make lint-ci | make lint
   └─ behavior:       make test*
```

`make fix` is optional preparation, not a validation check. It is the only validation command allowed
to rewrite tracked source; fixer steps that can touch the same files remain ordered. Its exit code is
advisory because some fixers report that they changed files. Checks begin only after normalize finishes
and may run concurrently because they observe the same stable content. If the target is absent,
validation remains non-blocking but reports actionable guidance to add this canonical normalize entry.

Complete validation runs every required check. Running lint or test alone is partial validation: it may
update that check's own stamp, but must not be presented as complete Component validation.

## Static-quality check

`make lint-ci` is preferred when present; otherwise devloop uses `make lint`. The selected target must
be non-interactive and read-only, and return zero only when all configured checks pass. If neither target
exists, static quality is skipped without a lint stamp. A full success stamps the post-normalize Component
content fingerprint so later edits invalidate it.

### Focused static quality

A project may explicitly consume `LINT_FILES`, a space-separated list of Component-relative
paths, in **both** `fix` and the selected `lint-ci` / `lint` target:

```console
make fix LINT_FILES="src/a.py tests/test_a.py"
make lint-ci LINT_FILES="src/a.py tests/test_a.py"
```

Missing or empty `LINT_FILES` retains full validation. The project owns file selection, supported file
types and dependency expansion: config/lockfile changes may require full checks, and Go/TypeScript
checks may need packages or the project graph rather than individual files. Do not change language
semantics or suppress diagnostics to simulate file-level support. Fixers must only rewrite the selected
files; read-only checks may expand their analysis where the language requires it.

Normalization uses frozen changed paths, limiting rewrites when the project supports `LINT_FILES`.
After normalization, repocli identifies affected Components and devloop runs each Component's full
lint target, clearing inherited `LINT_FILES`. Automatic validation does not narrow lint by file.
`--full` bypasses Component selection. Explicit file-level checks remain partial feedback and do
not update the full Component stamp.

Independent formatter checks, static analyzers, and type checkers may run concurrently through a native
worker pool or bounded Make target graph. Do not run multiple auto-fixers concurrently.

## Behavior check

Plain `make test` must run the Component's complete, non-interactive test suite, remain read-only, and
return zero only when the selected tests pass. The Makefile and native runner own discovery, scheduling,
fixtures, and cleanup; directory names alone do not define safe shards.

A project may optionally consume a space-separated `TEST_FILES` list of Component-relative paths:

```console
make test TEST_FILES="tests/a.py tests/b.py"
```

Missing or empty `TEST_FILES` retains full-suite behavior. `run_tests.py --full` explicitly requests
full tests in each selected Component. For a Makefile consuming `TEST_FILES`, passing only an empty
`TEST_FILES=` also runs and stamps a successful full suite; it must not be classified as narrowed.
Full runs explicitly clear inherited `TEST_FILES`. Non-empty files or other explicit test arguments
produce partial feedback and leave the full test stamp unchanged. `--full` rejects arguments after
`--` so the coverage request cannot contradict the runner arguments.

Before execution, devloop prints the Component, scope, selection reason and command (including files).
Automatic selection consumes repocli's Component impact facts. Known affected and incomplete
Components run full tests, even when repocli discovers no test files. Complete, unaffected Components
are omitted. Invalid reports or CLI failure select all current Components (within any explicit boundary).
Diagnostics remain visible on Board. Missing project test targets are reported as unavailable and
never stamped. Explicit file-level overrides must preserve language semantics; Go may require package
or test-name selection instead.

## Reusing successful execution

After normalization and dependency preparation, a check may reuse its latest successful
execution for the same checkout, Component, verified content fingerprint, command arguments,
scope and environment. Environment values are hashed, never persisted in the result record.
The output explicitly reports reuse. Failed, unavailable and skipped checks do not
qualify; missing or unstable content identity cannot authorize reuse.

Focused results are reusable only for the same selected files and do not create a full
Component stamp. Full-suite requests cannot reuse a focused result. Reuse preserves the
original validation stamps instead of reporting a new execution time.

## Capacity and reporting

- Expose conservative worker limits such as `LINT_JOBS`, `LINT_WORKERS`, or `TEST_WORKERS`; account for
  CPU quota, memory, databases, ports, and other shared resources.
- Prefer the test runner's native scheduler over one process per directory.
- Avoid multiplying unbounded Make jobs and unbounded native worker pools.
- Preserve a coherent result for every check so complete validation reports which quality dimension
  failed instead of flattening everything into one opaque pass/fail.

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

A project may explicitly consume `LINT_FILES`, a space-separated list of Component-relative changed
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

Lifecycle gates pass the frozen phase scope to both targets. Manual `run_lint.py` uses working-tree
changes; `--full` and `run_validate.py` run full Component checks. Unknown scope, deleted files, or
paths that cannot safely be passed through Make fall back to full checks. Projects without the
`LINT_FILES` contract retain full checks and receive adoption guidance.

A focused success can satisfy that inline gate, but does not update the full Component lint stamp.
It must not be presented as complete validation or reused to authorize a later bare commit.

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
Automatic selection uses repocli's automatic impact analysis, including unchanged affected tests.
Devloop supplies file lists; agents do not normally enumerate them. Successful valid repocli
reports select the returned tests even with analysis gaps; diagnostics remain visible on Board.
An empty returned list skips tests without a full stamp instead of passing `TEST_FILES=` to Make.
CLI or report failures fall back to full checks. Required full gates still take precedence.
Do not implement file-level selection where it changes language semantics; Go should expose package or test-name selection instead.

## Capacity and reporting

- Expose conservative worker limits such as `LINT_JOBS`, `LINT_WORKERS`, or `TEST_WORKERS`; account for
  CPU quota, memory, databases, ports, and other shared resources.
- Prefer the test runner's native scheduler over one process per directory.
- Avoid multiplying unbounded Make jobs and unbounded native worker pools.
- Preserve a coherent result for every check so complete validation reports which quality dimension
  failed instead of flattening everything into one opaque pass/fail.

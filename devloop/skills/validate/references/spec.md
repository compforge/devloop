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
exists, static quality is skipped without a lint stamp. A success stamps the post-normalize Component
content fingerprint so later edits invalidate it.

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

Missing or empty `TEST_FILES` retains full-suite behavior. Focused files or explicit extra test
arguments produce partial feedback and leave the full test stamp unchanged. Do not implement file-level
selection where it changes language semantics; Go should expose package or test-name selection instead.

## Capacity and reporting

- Expose conservative worker limits such as `LINT_JOBS`, `LINT_WORKERS`, or `TEST_WORKERS`; account for
  CPU quota, memory, databases, ports, and other shared resources.
- Prefer the test runner's native scheduler over one process per directory.
- Avoid multiplying unbounded Make jobs and unbounded native worker pools.
- Preserve a coherent result for every check so complete validation reports which quality dimension
  failed instead of flattening everything into one opaque pass/fail.

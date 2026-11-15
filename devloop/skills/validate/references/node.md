# Node validation guidance

## Format and lint

Use the package manager pinned by the lockfile and preserve the existing tool configuration.
ESLint/Prettier can consume file paths; TypeScript checking should keep its project boundary.
Passing files directly to `tsc` ignores `tsconfig.json`, so do not implement it as `tsc $(LINT_FILES)`.

For a project whose pinned ESLint supports `--concurrency`, this example uses Make to schedule
independent checks and disables ESLint's nested pool:

```make
LINT_WORKERS ?= 2
LINT_PATHS := .
ifneq ($(strip $(LINT_FILES)),)
ifeq ($(filter-out %.js %.jsx %.ts %.tsx %.mjs %.cjs %.mts %.cts,$(LINT_FILES)),)
LINT_PATHS := $(LINT_FILES)
endif
endif

.PHONY: format lint lint-ci lint-eslint lint-format lint-types
format:
	pnpm exec prettier --write $(LINT_PATHS)
lint:
	$(MAKE) --no-print-directory -j$(LINT_WORKERS) lint-eslint lint-format lint-types
lint-ci: lint
lint-eslint:
	pnpm exec eslint --concurrency off $(LINT_PATHS)
lint-format:
	pnpm exec prettier --check $(LINT_PATHS)
lint-types:
	pnpm exec tsc --noEmit
```

Empty or unrecognized file selections use full checks. Adapt supported extensions to project tools;
never turn a nonempty unsupported selection into an empty successful check. Preserve project-wide
type checking even when lint/format feedback is focused. Large monorepos can use their existing
TypeScript project references instead of inventing temporary file-only configurations.

If ESLint dominates and runs alone, map `LINT_WORKERS` to its native `--concurrency` instead.
Older versions may lack that option; inspect the pinned tool before adding flags. Keep requested
auto-fixers ordered before checks, and avoid multiplying Make jobs and native pools.

See [ESLint concurrency](https://eslint.org/docs/latest/use/command-line-interface#--concurrency),
[tsc file and project semantics](https://www.typescriptlang.org/docs/handbook/compiler-options.html),
and [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html).

## Test

Let the selected runner own its worker pool. For Jest, use `--runTestsByPath` only with a nonempty
selection so plain `make test` still discovers the full suite:

```make
TEST_WORKERS ?= 2
TEST_FILES ?=
JEST_FILE_ARGS = $(if $(strip $(TEST_FILES)),--runTestsByPath $(TEST_FILES),)

.PHONY: test
test:
	pnpm exec jest --maxWorkers=$(TEST_WORKERS) $(JEST_FILE_ARGS)
```

For Vitest, use its non-interactive `run` command:

```make
TEST_WORKERS ?= 2
TEST_FILES ?=

.PHONY: test
test:
	pnpm exec vitest run --maxWorkers=$(TEST_WORKERS) $(TEST_FILES)
```

Vitest positional paths filter test files rather than promising exact path equality. Keep the pinned
runner's selection semantics visible. Worker limits control file execution, not test concurrency
inside each file; lower them when tests share external resources.

See [Jest CLI](https://jestjs.io/docs/cli), [Vitest filtering](https://vitest.dev/guide/filtering),
and [Vitest maxWorkers](https://vitest.dev/guide/cli#maxworkers).

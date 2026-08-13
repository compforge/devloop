# Node validation guidance

## Fix and lint

Keep Prettier and ESLint writers ordered; run read-only checks concurrently:

```make
LINT_JOBS ?= 3

.PHONY: fix lint lint-ci lint-eslint lint-format lint-types
fix:
	pnpm exec prettier --write .
	pnpm exec eslint --fix .
lint:
	$(MAKE) --no-print-directory -j$(LINT_JOBS) lint-eslint lint-format lint-types
lint-ci: lint
lint-eslint:
	pnpm exec eslint .
lint-format:
	pnpm exec prettier --check .
lint-types:
	pnpm exec tsc --noEmit
```

Use the package manager pinned by the lockfile. If ESLint dominates and runs alone, its
`--concurrency <n|auto>` can provide workers; do not combine unbounded Make and ESLint concurrency.
Large TypeScript monorepos may use project references and `tsc --build`. See
[ESLint concurrency](https://eslint.org/docs/latest/use/command-line-interface#--concurrency),
[Prettier check mode](https://prettier.io/docs/install.html), and
[TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html).

## Test

Let the selected runner own its worker pool.

### Jest

Use `--runTestsByPath` only when `TEST_FILES` is non-empty so the ordinary target still discovers the
full suite:

```make
TEST_WORKERS ?= 4
TEST_FILES ?=
JEST_FILE_ARGS = $(if $(strip $(TEST_FILES)),--runTestsByPath $(TEST_FILES),)

.PHONY: test
test:
	npm test -- --maxWorkers=$(TEST_WORKERS) $(JEST_FILE_ARGS)
```

See Jest's [`--maxWorkers` and `--runTestsByPath`](https://jestjs.io/docs/cli).

### Vitest

Vitest runs test files in parallel by default; `maxWorkers` supplies the capacity limit. Positional
file paths can optionally narrow the run:

```make
TEST_WORKERS ?= 4
TEST_FILES ?=

.PHONY: test
test:
	npm test -- --maxWorkers=$(TEST_WORKERS) $(TEST_FILES)
```

This controls file-level workers, not tests within one file. Lower the worker count when tests share
external resources.

See Vitest's [parallelism guide](https://vitest.dev/guide/parallelism) and
[`maxWorkers` CLI option](https://vitest.dev/guide/cli#maxworkers).

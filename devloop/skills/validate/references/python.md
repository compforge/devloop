# Python validation guidance

## Format and lint

Reuse the project's configured Ruff/mypy entrypoints. This example narrows Ruff to Python inputs,
retains full behavior for empty or unsupported selections, and keeps mypy at project scope:

```make
LINT_WORKERS ?= 2
RUFF_PATHS := .
ifneq ($(strip $(LINT_FILES)),)
ifeq ($(filter-out %.py %.pyi,$(LINT_FILES)),)
RUFF_PATHS := $(LINT_FILES)
endif
endif

.PHONY: format lint lint-ci lint-ruff lint-mypy
format:
	uv run ruff format $(RUFF_PATHS)
lint:
	$(MAKE) --no-print-directory -j$(LINT_WORKERS) lint-ruff lint-mypy
lint-ci: lint
lint-ruff:
	RAYON_NUM_THREADS=1 uv run ruff check $(RUFF_PATHS)
	RAYON_NUM_THREADS=1 uv run ruff format --check $(RUFF_PATHS)
lint-mypy:
	uv run mypy .
```

Here Make schedules independent lint stages and Ruff's pool is capped at one per stage, so worker
budgets do not multiply across layers. With only two stages, increasing `LINT_WORKERS` beyond two
does not add useful capacity. A Ruff-only project can instead map the budget to its Rayon pool
and run stages sequentially; verify the pinned runner's behavior before adopting the mapping.
See the [Ruff maintainer's Rayon example](https://github.com/astral-sh/ruff/discussions/5523).

Preserve project include/exclude rules and expand configuration/dependency changes appropriately.
Mypy file arguments can still analyze imports; narrow its scope only when the project supports it.
Use the project's existing incremental-cache policy; devloop does not clear `.mypy_cache`.
Keep any requested lint auto-fixes ordered before checks; do not put writers in concurrent lint.
See [Ruff configuration](https://docs.astral.sh/ruff/configuration/) and
[mypy incremental mode](https://mypy.readthedocs.io/en/stable/command_line.html#incremental-mode).

## Test

Pytest accepts `TEST_FILES` directly; empty arguments retain its configured discovery. If the
project already has pytest-xdist and independent tests, expose its native worker pool:

```make
TEST_WORKERS ?= 2
TEST_FILES ?=

.PHONY: test
test:
	uv run pytest -n $(TEST_WORKERS) $(TEST_FILES)
```

Without xdist, retain `uv run pytest $(TEST_FILES)` and recommend the dependency only when parallel
execution would help and the task authorizes dependency changes. Do not add `-n` to plain pytest.
Tests sharing external state may require xdist grouping, isolated fixtures or serial execution;
positive `TEST_WORKERS=1` still uses an xdist worker, not plain pytest's main process.

See the [pytest-xdist distribution guide](https://pytest-xdist.readthedocs.io/en/stable/distribution.html).

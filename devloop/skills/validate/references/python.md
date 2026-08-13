# Python validation guidance

## Fix and lint

Ruff lint fixes may change imports before formatting. Keep writers ordered, then parallelize independent
Ruff and mypy checks:

```make
LINT_JOBS ?= 2

.PHONY: fix lint lint-ci lint-ruff lint-mypy
fix:
	uv run ruff check --fix .
	uv run ruff format .
lint:
	$(MAKE) --no-print-directory -j$(LINT_JOBS) lint-ruff lint-mypy
lint-ci: lint
lint-ruff:
	uv run ruff check .
	uv run ruff format --check .
lint-mypy:
	uv run mypy .
```

Devloop clears `.mypy_cache` before the canonical gate so stale warm state cannot validate code that
would fail cold. Keep `dmypy` as a separate local-feedback command, not the reproducible gate. See
[Ruff configuration](https://docs.astral.sh/ruff/configuration/) and
[mypy daemon trade-offs](https://mypy.readthedocs.io/en/stable/mypy_daemon.html).

## Test

Add `pytest-xdist` to the project's development dependencies, then let xdist distribute collected
tests. Use a conservative, overridable worker limit:

```make
TEST_WORKERS ?= 4
TEST_FILES ?=

.PHONY: test
test:
	uv run pytest -n $(TEST_WORKERS) $(TEST_FILES)
```

Tests sharing external state may need xdist grouping or fewer workers.

See the [pytest-xdist distribution guide](https://pytest-xdist.readthedocs.io/en/stable/distribution.html).

PYTHON := scripts/python
.PHONY: fix lint lint-ci test test-opencode build
fix:
	# Prepare tracked artifacts before lint/test run concurrently.
	npm run build
	uvx --from ruff==0.16.10 ruff check --fix --select E9,F63,F7,F82 scripts
lint:
	uvx --from ruff==0.16.10 ruff check --select E9,F63,F7,F82 scripts
	sh -n scripts/python
	npm run typecheck
lint-ci: lint
test:
	# Validate source and the prepared bundle without rewriting the snapshot.
	npx vitest run
	$(PYTHON) scripts/tests/run_all.py
build:
	npm run build

# Requires an installed OpenCode V2; the fixture uses an isolated local mock model.
test-opencode: build
	DEVLOOP_OPENCODE_BIN=$${DEVLOOP_OPENCODE_BIN:-opencode} npx vitest run tests/opencode-host.spec.ts

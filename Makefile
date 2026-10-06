# devloop marketplace — repo-level Makefile.
# 仓库级工具入口；各 plugin 自身的开发命令在 <plugin>/Makefile（若有）。

PYTHON := devloop/scripts/python

TEST_FILES ?=

.PHONY: help fix lint test build typecheck bump-version

help:
	@echo "Targets:"
	@echo "  test [TEST_FILES='devloop/scripts/tests/test_x.py ...']"
	@echo "  fix / lint"
	@echo "  build"
	@echo "  typecheck"
	@echo "  bump-version PLUGIN=<name> [LEVEL=patch|minor|major]"
	@echo "  bump-version PLUGIN=<name> VERSION=<x.y.z>"
	@echo ""
	@echo "Examples:"
	@echo "  make test"
	@echo "  make test TEST_FILES='devloop/scripts/tests/test_git_ops.py'"
	@echo "  make bump-version PLUGIN=devloop"
	@echo "  make bump-version PLUGIN=devloop LEVEL=minor"
	@echo "  make bump-version PLUGIN=devloop VERSION=0.1.0"

# Keep legacy workflow style while checking syntax and definite Python errors.
fix:
	uvx --from ruff==0.16.10 ruff check --fix --select E9,F63,F7,F82 devloop/scripts
lint:
	uvx --from ruff==0.16.10 ruff check --select E9,F63,F7,F82 devloop/scripts
	sh -n devloop/scripts/python

test:
	@if [ -n "$(strip $(TEST_FILES))" ]; then \
		for test_file in $(TEST_FILES); do \
			MAKEFLAGS= MFLAGS= TEST_FILES= $(PYTHON) "$$test_file" || exit $$?; \
		done; \
	else \
		npm --prefix devloop run check && $(PYTHON) devloop/scripts/tests/run_all.py; \
	fi

build:
	npm --prefix devloop run build

typecheck:
	npm --prefix devloop run typecheck

bump-version:
	@test -n "$(PLUGIN)" || { echo "ERROR: PLUGIN is required, e.g. make bump-version PLUGIN=devloop"; exit 1; }
	@python3 scripts/bump_plugin_version.py \
		--plugin "$(PLUGIN)" \
		$(if $(VERSION),--version "$(VERSION)",--level "$(or $(LEVEL),patch)")

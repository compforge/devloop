# devloop marketplace — repo-level Makefile.
# 仓库级工具入口；各 plugin 自身的开发命令在 <plugin>/Makefile（若有）。

PYTHON := devloop/scripts/python


.PHONY: help fix lint test build typecheck bump-version

help:
	@echo "Targets:"
	@echo "  test"
	@echo "  fix / lint"
	@echo "  build"
	@echo "  typecheck"
	@echo "  bump-version PLUGIN=<name> [LEVEL=patch|minor|major]"
	@echo "  bump-version PLUGIN=<name> VERSION=<x.y.z>"
	@echo ""
	@echo "Examples:"
	@echo "  make test"
	@echo "  make bump-version PLUGIN=devloop"
	@echo "  make bump-version PLUGIN=devloop LEVEL=minor"
	@echo "  make bump-version PLUGIN=devloop VERSION=0.1.0"

fix lint test build:
	$(MAKE) -C devloop $@

typecheck:
	npm --prefix devloop run typecheck

bump-version:
	@test -n "$(PLUGIN)" || { echo "ERROR: PLUGIN is required, e.g. make bump-version PLUGIN=devloop"; exit 1; }
	@python3 scripts/bump_plugin_version.py \
		--plugin "$(PLUGIN)" \
		$(if $(VERSION),--version "$(VERSION)",--level "$(or $(LEVEL),patch)")

PYTHON ?= python3
.PHONY: fix lint test
# Skill assets have no generated source to normalize.
fix:
	@true
lint:
	$(PYTHON) scripts/check_assets.py
test:
	$(PYTHON) -m unittest discover -s tests

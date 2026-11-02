PYTHON ?= python3
.PHONY: format lint test
# Skill assets have no generated source to normalize.
format:
	@true
lint:
	$(PYTHON) scripts/check_assets.py
test:
	$(PYTHON) -m unittest discover -s tests

.PHONY: format lint test build test-opencode
format: build
lint:
	npm run typecheck
test:
	npm test
build:
	npm run build
test-opencode: build
	node tests/opencode-host.mjs

# Explicit opt-in: three synthetic prompts sent to the real OpenAI Decisions API.
.PHONY: test-live
test-live: build
	node tests/live-decisions.mjs

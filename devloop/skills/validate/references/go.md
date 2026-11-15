# Go validation guidance

## File scope and targets

Map `LINT_FILES` and `TEST_FILES` to unique owning packages. Never pass individual `_test.go`
files to `go test`: doing so changes package compilation and can omit helpers and fixtures.
Focused here means selected packages, including all their tests. Empty or unrecognized inputs
retain the full check; configuration/dependency changes require the appropriate broader scope.

For a module using standard Go tools:

```make
LINT_WORKERS ?= 2
TEST_WORKERS ?= 2
GO_TEST_PARALLEL ?= 1
LINT_PACKAGES := ./...
TEST_PACKAGES := ./...
ifneq ($(strip $(LINT_FILES)),)
ifeq ($(filter-out %.go,$(LINT_FILES)),)
LINT_PACKAGES := $(sort $(addprefix ./,$(dir $(LINT_FILES))))
endif
endif
ifneq ($(strip $(TEST_FILES)),)
ifeq ($(filter-out %.go,$(TEST_FILES)),)
TEST_PACKAGES := $(sort $(addprefix ./,$(dir $(TEST_FILES))))
endif
endif

.PHONY: format lint lint-ci test
format:
	go fmt $(LINT_PACKAGES)
lint:
	go vet -p $(LINT_WORKERS) $(LINT_PACKAGES)
lint-ci: lint
test:
	go test -p $(TEST_WORKERS) -parallel $(GO_TEST_PARALLEL) $(TEST_PACKAGES)
```

Preserve existing checks such as gofmt verification, race detection and project-specific flags
when adapting this example. `format` performs formatting; lint auto-fixes need an explicitly
requested project action. If the project uses golangci-lint, its lint recipe can use
`golangci-lint run --concurrency $(LINT_WORKERS) $(LINT_PACKAGES)` instead of introducing
separate runners per directory. Its runner coordinates linters and normally locks concurrent instances.

## Capacity

`go test -p` limits concurrent package/build programs. `-parallel` separately limits tests within
one test binary that call `t.Parallel()`. The example starts package workers at 2 and in-package
parallelism at 1; choose project defaults from existing behavior and available resources rather
than copying these values blindly. Do not raise both limits together during tuning: their effects
can multiply. A serial test inside one package may not benefit from more package workers.

See the official [Go test flags](https://pkg.go.dev/cmd/go#hdr-Testing_flags) and
[golangci-lint concurrency contract](https://golangci-lint.run/docs/configuration/cli/#run).

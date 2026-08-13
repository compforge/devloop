# Go validation guidance

## Fix and lint

If the project uses golangci-lint, let its runner coordinate linters and cap its native worker pool:

```make
LINT_WORKERS ?= 4

.PHONY: fix lint lint-ci
fix:
	golangci-lint run --fix --concurrency $(LINT_WORKERS)
lint:
	golangci-lint run --concurrency $(LINT_WORKERS)
lint-ci: lint
```

Do not start separate runners per directory; golangci-lint already analyzes packages concurrently and
normally locks against concurrent instances. With only standard Go tools, use `go fmt ./...` in `fix`
and `go vet -p $(LINT_WORKERS) ./...` in `lint`. See the
[golangci-lint concurrency contract](https://golangci-lint.run/docs/configuration/cli/#run).

## Test

Go runs package test binaries concurrently; `-p` limits concurrent package/build programs, while
`-parallel` separately limits tests within one package that call `t.Parallel()`:

```make
TEST_WORKERS ?= 4
GO_TEST_PARALLEL ?= 1
TEST_PACKAGES ?= ./...

.PHONY: test
test:
	go test -p $(TEST_WORKERS) -parallel $(GO_TEST_PARALLEL) $(TEST_PACKAGES)
```

Prefer package or test-name selection, for example `make test TEST_PACKAGES=./internal/foo`. Passing
individual `_test.go` files changes package compilation semantics, so do not expose `TEST_FILES`
merely for interface uniformity.

The two concurrency limits apply at different levels and can multiply. Raise `GO_TEST_PARALLEL` only
when `t.Parallel()` tests are independent and package-level parallelism alone is insufficient; reduce
either limit when tests share external resources.

See the official [`go test` flags](https://pkg.go.dev/cmd/go#hdr-Testing_flags).

# Quality

Quality is a skill-only plugin that helps coding agents evaluate project-owned quality capabilities.
It does not ship test suites or replace the frameworks and business assets that make a test
executable.

The first bundled skill is `e2e`. It connects three layers without merging their ownership:

1. a framework such as case-harness may provide reusable execution and verdict primitives;
2. each business project owns its real E2E code, cases, adapters, and acceptance criteria;
3. instructions beside that E2E code preserve project-specific setup, failure, cleanup, and evidence
   knowledge.

The skill reads the project first, discovers its existing E2E entrypoint, executes it when the
required target is available, and reports evidence. If no runnable suite exists, it returns
`no_capability` rather than inventing tests or presenting source review as validation.

## Install

Add the devloop marketplace once, then install the plugin.

Claude Code:

```text
/plugin marketplace add https://github.com/compforge/devloop.git
/plugin install quality@devloop
```

Codex:

```bash
codex plugin marketplace add https://github.com/compforge/devloop.git
codex plugin add quality@devloop
```

Start a new session after installation so the agent can discover the bundled skill.

## Use

Ask for the outcome instead of naming a framework command:

```text
Run this project's E2E tests and report the result.
Check whether the test environment passes E2E.
Find and execute the existing E2E capability; tell me if the project has none.
```

The skill only triggers and evaluates existing project-owned E2E tests. It does not create tests,
change assertions, fix failures, deploy environments, or turn unavailable coverage into a pass.

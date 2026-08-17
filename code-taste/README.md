# Code Taste

Code Taste gives AI coding agents a judgment-first engineering discipline. It helps clarify the
original requirement, control complexity, shape models and module boundaries, choose precise names,
and review code at the depth warranted by the change.

It is a skill-only plugin: it adds no hooks, external tools, credentials, or persistent state.

## What it covers

- Architecture, modeling, module boundaries, dependency direction, and maintainability
- Refactoring tradeoffs, code review, naming, documentation, and intent markers
- T0/T1/T2 routing so routine edits stay lightweight while structural changes receive deeper review
- Language-specific guidance for Go, Python, and TypeScript

Code Taste is not a linter or debugger. It guides engineering judgment; project tests, linters, and
runtime diagnostics remain the source of implementation evidence.

## Install

Add the marketplace once, then install the plugin.

Claude Code:

```text
/plugin marketplace add https://github.com/compforge/devloop.git
/plugin install code-taste@devloop
```

Codex:

```bash
codex plugin marketplace add https://github.com/compforge/devloop.git
codex plugin add code-taste@devloop
```

Start a new session after installation so the agent can discover the bundled skill.

## Use

The skill activates for design and implementation work that benefits from engineering judgment. You
can also invoke it explicitly:

```text
Use code-taste to review this design before implementation.
Use code-taste to assess the module boundaries in this refactor.
Use code-taste to improve these names without changing behavior.
```

For debugging and incident triage, establish runtime evidence first and use Code Taste only when the
result points to a structural design issue.

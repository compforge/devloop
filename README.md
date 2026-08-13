[English](./README.md) | [简体中文](./README.zh-CN.md)

# devloop

**A controlled PR/MR development lifecycle for AI coding agents.**

This repository is a cross-CLI plugin marketplace. Its flagship plugin, `devloop`, helps Claude Code and Codex complete branch-based development without losing control of repository state, validation, Git mutations, or concurrent sessions.

```text
enter repo → develop → normalize → lint ∥ test → commit → push → PR/MR → human merge
```

devloop supports GitHub PRs and GitLab MRs, selected from each repository's origin. Merge remains a human decision.

## Why devloop

AI coding often loses time at the boundaries around the code:

- **Information lag** — the agent guesses the current repository, branch, PR/MR, and validation state from conversation history.
- **Soft conventions do not enforce themselves** — instructions such as “do not commit to main” or “do not use `git add -A`” can still be bypassed without execution-level guards.
- **Concurrent sessions collide** — multiple agents sharing one checkout can switch branches underneath each other, mix uncommitted work, or resolve an operation to the wrong repository.

devloop turns those boundaries into a reusable development loop: live context tells the agent where it is, controlled transactions own Git side effects, validation runs against affected Components, and managed worktrees isolate concurrent work.

## What the devloop plugin provides

- **Controlled Git/PR transactions** — `gcam`, `gcamp`, and `gcampr` perform commit, commit + push, and commit + push + PR/MR respectively. New work starts from the intended target branch instead of inheriting accidental commits from the current HEAD.
- **Affected-Component validation** — a repository may contain independent Components such as `server/`, `cli/`, or `packages/*`. devloop selects the Components touched by the change and records lint/test results at the same granularity.
- **One validation model** — complete validation normalizes with `make fix`, then runs static-quality and behavioral checks concurrently through canonical Make targets. Lint or test alone is reported as partial validation.
- **Current repository context** — branch, working tree, PR/MR, and validation facts are surfaced to the active session and refreshed as the development state changes.
- **Execution-level guardrails** — high-confidence risks such as protected-branch commits, inactive-branch edits, broad staging, and unmanaged worktree creation are denied before they mutate the repository.
- **Concurrent-session isolation** — checkout ownership prevents one session from changing another session's branch or tracked files and routes parallel work to a managed worktree.
- **Safe PR/MR continuation** — an existing PR/MR can receive additional commits, review output, or a resumable conflict rebase without handing merge authority to the agent.

The stable domain spine is **PR/MR → Repo → Component**. A workspace is an optional context that groups multiple repositories; single-repository use is fully supported.

For the validation contract, configuration, commands, and advanced workflows, see the [devloop plugin README](./devloop/README.md).

## Quick start

Runtime requirement: **Python 3.10+**. Set `DEVLOOP_PYTHON` only when you need to force a specific interpreter.

### Claude Code

```text
/plugin marketplace add https://github.com/compforge/devloop.git
/plugin install devloop@devloop
```

### Codex

```console
codex plugin marketplace add https://github.com/compforge/devloop.git
codex plugin add devloop@devloop
```

Start a new session after installation. If Codex asks for hook review, open `/hooks` and trust the devloop hooks. Repository state is initialized automatically when the agent first enters a Git repository.

Then use outcome-oriented requests instead of assembling shell commands yourself:

```text
validate the changes
gcampr
```

PR/MR creation and remote state refresh require credentials for the repository host. Prefer `GITHUB_TOKEN`, `GH_TOKEN`, or `GITLAB_TOKEN`; host-specific configuration is documented in the [plugin README](./devloop/README.md).

## Project validation contract

Each Component exposes stable, non-interactive Make targets:

```text
make fix                  # optional normalization; may rewrite source
make lint-ci | make lint  # read-only static-quality check
make test                 # read-only full behavioral suite
```

Projects may additionally accept `TEST_FILES` for focused feedback on large suites, while an empty value must retain full-suite behavior. See the [validation contract](./devloop/skills/validate/references/spec.md) and the language-specific guidance for [Python](./devloop/skills/validate/references/python.md), [Go](./devloop/skills/validate/references/go.md), or [Node.js](./devloop/skills/validate/references/node.md). The plugin README explains when focused tests are selected.

## Configuration

All lifecycle hooks are opt-in. User configuration lives in `~/.devloop/config.json`; a repository or workspace can provide a closer `.devloop/config.json` override. The same configuration controls forge credentials, lifecycle validation/review hooks, review engine selection, and managed-worktree retention.

See [`config/config.example.json`](./devloop/config/config.example.json) for the complete schema. The default review engine is [CCR](https://github.com/compforge/case-code-review); review is asynchronous and never blocks commit or PR/MR creation.

## Scope and compatibility

- **Harnesses:** Claude Code and Codex are supported. Claude uses its full native event set; Codex uses its available hooks with refresh and TTL fallbacks for missing events.
- **Forges:** GitHub and GitLab are peer providers selected per repository.
- **Ownership:** devloop owns the coding-harness development loop: repo/branch state, validation, commit/push, PR/MR creation, review delivery, and execution guardrails.
- **Boundary:** requirement identity, cross-repository orchestration, deployment, long-running scheduling, and session wakeups belong to higher-level loops such as Baton and the [ReqLoop Marketplace](https://github.com/compforge/reqloop).
- **opencode:** the marketplace contains a placeholder plugin, but the devloop plugin is not wired to opencode yet.

## Updating

Claude Code:

```text
/plugin marketplace update devloop
/plugin update devloop
```

Codex:

```console
codex plugin marketplace upgrade devloop
codex plugin remove devloop@devloop
codex plugin add devloop@devloop
```

Start a new session after updating so the runtime reloads hooks and skills. User configuration under `~/.devloop/` is preserved.

## Plugins

| Plugin | Purpose | Documentation |
|---|---|---|
| `devloop` | Controlled PR/MR development lifecycle for Claude Code and Codex | [README](./devloop/README.md) |
| `example` | Placeholder demonstrating the multi-plugin marketplace layout | [README](./example/README.md) |

## Documentation

- [devloop plugin usage](./devloop/README.md)
- [marketplace architecture and contribution boundaries](./AGENTS.md)
- [contributing a plugin](./CONTRIBUTING.md)

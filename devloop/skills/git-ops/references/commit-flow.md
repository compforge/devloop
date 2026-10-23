# Commit flow

| Requested outcome | Entry point |
|---|---|
| Commit | `bash <PLUGIN_ROOT>/scripts/smart_gcam.sh` |
| Commit + push | `bash <PLUGIN_ROOT>/scripts/smart_gcamp.sh` |
| Commit + push + create/reuse PR/MR | `bash <PLUGIN_ROOT>/scripts/smart_gcampr.sh` |

Pass `--message '<subject>'` or `--message-file <path>`; use `--help` for the full options.
The subject becomes the PR/MR title and the body supplies its description. Follow-up commit bodies
are appended to an existing description; use [pr update](pr-management.md) when it needs rewriting
to describe the final change. Report the resulting commit/push state and PR/MR URL when applicable.

For multiline messages, fully overwrite the one-shot `<repo>/.devloop/commit_msg` and pass it with
`--message-file`. It is removed on success and retained on failure; previous contents are not input.

## Scope

- `--repo <name|path>` selects the repository; use it when cwd is ambiguous.
- Repeat `--file <path>` for explicit task scope, including untracked files. Without it, staging
  includes tracked modifications only. Paths are repo-relative; staged files outside an explicit
  scope cause refusal. Preserve unrelated staging.
- Prefer [branch creation](branch.md) before editing. `--branch <name>` supports changes already
  made for a new branch, including retry after an inactive-branch refusal.
- `--target <branch>` overrides the repository's default target; `--base <ref>` chooses an explicit
  local branch start.

## Contributing to another repository

Only gcampr accepts `--target-repository <forge/path>`, a concrete Repository ID such as
`github/owner/repo`. Omission targets the current repository; being a fork does not imply an upstream
PR. Resolve the intended destination from the task, using `forked_from` as metadata when relevant.
Ask only if that destination remains ambiguous.

Source and push remain on the current repository's origin; the destination must be on the same
Forge instance. With an explicit destination, `--target` selects the PR base without changing the
local baseline. Without `--target`, an existing PR keeps its base and a new PR uses the destination's
default branch. Repeat the destination ID on later invocations; branch/worktree state does not
retain it.

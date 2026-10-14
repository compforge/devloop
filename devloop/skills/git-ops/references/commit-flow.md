# Commit / push / PR flow

Use the transaction matching the requested outcome:

| Intent | Script |
|---|---|
| Commit only | `bash <PLUGIN_ROOT>/scripts/smart_gcam.sh --message '<msg>' [...]` |
| Commit and push | `bash <PLUGIN_ROOT>/scripts/smart_gcamp.sh --message '<msg>' [...]` |
| Commit, push, and create/reuse PR/MR | `bash <PLUGIN_ROOT>/scripts/smart_gcampr.sh --message '<msg>' [...]` |

## Message

Keep the first line short; it becomes the PR/MR title. Put what/why details after a blank line.

- Simple one-line message: pass `--message 'fix: ...'`.
- Multi-line text or shell-sensitive characters: fully overwrite the gitignored one-shot file
  `<repo>/.devloop/commit_msg` with the Write tool, then pass `--message-file <path>` (`-F`). Do not
  read, edit, or patch the previous scratch content. The script removes it on success and retains it
  on failure.

Follow-up commits to an in-flight PR/MR append the message body to its description without
overwriting human edits.

## Scope and branch

- Pass `--repo <name|path>` from a workspace root or when the target repo is ambiguous.
- Prefer the dedicated [[branch|branch flow]] before editing new work. Pass `--branch <name>` here
  only when changes already exist and intentionally belong on a fresh branch, or when one atomic
  commit transaction must create the branch.
- Pass `--target <branch>` only when the destination differs from the repository default.
- Repeat `--file <path>` when unrelated or untracked files exist; otherwise only tracked modifications
  are staged. Paths are resolved against the repo root. Never use `git add -A`.
  Explicit paths bound the entire commit: existing staged changes outside that scope cause refusal.
  Directories are expanded and filtered per file; rejection preserves the original index, including
  partial staging. Do not clear unrelated staging to make the check pass.

Trust the `PLAN:` banner. On `INACTIVE`, the script performs an authoritative forge refresh and
reports the matching PR/MR state and SHA; add `--branch` and retry rather than bypassing the script.
For gcampr, surface the returned PR/MR URL.

## PR destination

Only gcampr accepts `--target-repository <forge/path>`, a common Repository ID such as
`github/odvcencio/gotreesitter`. Omission targets the current repository. The source always
remains the current repository, and push remains on origin. Both repositories must be on
the same Forge instance.

Resolve the destination from the user's context before invoking the command. Repository
`forked_from` provides a same-Forge parent path when relevant; combine it with the current
Forge name to obtain the destination ID. Ask the user when intent is ambiguous. The command
accepts concrete IDs, with no `current`/`parent` selector or automatic parent fallback.

With an explicit destination, `--target` selects the PR's base branch without changing the
local Git baseline. Omitted, an existing PR keeps its base and a new PR uses the destination's
default branch. Use `--base` for an explicit local branch start. Repeat the destination ID
when reusing an upstream PR; branch/worktree state and current-repository monitoring do not
store that choice.

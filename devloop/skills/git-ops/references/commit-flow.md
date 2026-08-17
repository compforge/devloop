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

Trust the `PLAN:` banner. On `INACTIVE`, the script performs an authoritative forge refresh and
reports the matching PR/MR state and SHA; add `--branch` and retry rather than bypassing the script.
For gcampr, surface the returned PR/MR URL.

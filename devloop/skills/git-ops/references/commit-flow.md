# Commit flow

| Requested outcome | Execution |
|---|---|
| Commit | `bash <PLUGIN_ROOT>/scripts/smart_gcam.sh` |
| Commit + push | `bash <PLUGIN_ROOT>/scripts/smart_gcamp.sh` |
| Commit + push + PR/MR | AI runs the commit-and-push transaction, then `repocli pr create` |

Before publishing code, run `repocli validate --repo <repo> --base <baseline> --check format,lint,test`.
Use HEAD for uncommitted edits, or the target baseline for a committed branch. Inspect results and
fix relevant failures. These commands are issued by the AI following the skill; the Git transaction
neither launches repocli nor requires validation records.

Select the actual repository with `--repo <path>`. Repeat `--file <path>` for explicit, repo-relative
commit scope, including untracked files. Existing staged files outside that scope cause refusal.
Without `--file`, only tracked modifications are selected. Preserve unrelated staging.

Pass `--message` or `--message-file`; fully overwrite the one-shot `<repo>/.devloop/commit_msg`
for multiline text and pass that path. It is removed after success and retained after failure.
The commit message is separate from the PR title/body. The workflow does not append commit bodies
to PR descriptions; the AI updates a PR description to explain the final implementation when needed.

New work starts through [branch creation](branch.md). `--branch <name>` handles edits already made
on a protected/inactive branch. `--base <ref>` selects a local start explicitly; `--target <branch>`
selects the Git baseline and defaults to the repository's local default target.

## Create or reuse the PR/MR

After a successful push, the AI invokes [native PR commands](pr-management.md) directly:

```bash
repocli pr list --repo <repo> --head <branch> --state open --json
repocli pr create --repo <repo> --head <branch> --base <target> --title '<title>' --body-file <file> --json
```

Resolve the destination and base before creation. Reuse an existing proposal's base unless the
user requests another target. Multiple candidates need an explicit selection. The CLI owns
create/reuse identity and post-success maintenance. Report a PR failure separately from a
successful commit/push, so retrying does not duplicate Git work.

For a fork, pass `--target-repository owner/repo` to each PR query/write. Omission means the origin
repository; fork metadata does not authorize publishing upstream. The PR base is independent of
the commit transaction's local Git baseline. Author the body in an ignored local file and preserve
user-authored content when updating an existing proposal.

After PR creation/update, use [review](../../review/SKILL.md) to check the current run. Do not start
a duplicate review for the same revision. Otherwise start review through its managed entrypoint.
Merge remains a human action. Report the commit, push and PR outcomes separately.

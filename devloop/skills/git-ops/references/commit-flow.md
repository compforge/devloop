# Commit flow

| Requested outcome | Execution |
|---|---|
| Commit | `bash <PLUGIN_ROOT>/scripts/smart_gcam.sh` |
| Commit + push | `bash <PLUGIN_ROOT>/scripts/smart_gcamp.sh` |
| Commit + push + PR/MR | AI runs the commit-and-push transaction, then `repocli pr create` |

Before publishing code, run `repocli validate --repo <repo> --base <baseline> --check format,lint,test --json`.
Use HEAD for uncommitted edits, or the target baseline for a committed branch. Inspect results and
fix relevant failures. These commands are issued by the AI following the skill; the Git transaction
neither launches repocli nor requires validation records.

Select the actual repository with `--repo <path>`. Repeat `--file <path>` for explicit, repo-relative
commit scope, including untracked files. Existing staged files outside that scope cause refusal.
Paths are literal checkout-root-relative names; no cwd-based rebasing is performed.
Without `--file`, only tracked modifications and existing staging are selected. A sensitive write
in the complete candidate causes refusal; sensitive deletions remain allowed. Preserve unrelated staging.

The managed transaction consumes `repocli git commit plan/create` (CLI 0.76.0+). It checks policy
against the candidate and passes its frozen branch/head/tree/index fingerprint back for creation.
Hooks still run natively; a changed tree or unknown result stops publication. Use the reported
`git commit check` identity and recovery path before retrying; confirmed commits are never recreated
merely because index installation or a later workflow action failed.

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
repocli pr create --repo <repo> --head <branch> --base <target> --title '<title>' --body-file <file> --json
```

When destination and base are known, call create directly; it discovers and reuses the unique open proposal.
Query first only when selecting an unknown target or resolving ambiguity. Resolve the destination and base before creation. Reuse an existing proposal's base unless the
user requests another target. Multiple candidates need an explicit selection. The CLI owns
create/reuse identity and affected observation updates. Report a PR failure separately from a
successful commit/push, so retrying does not duplicate Git work. Consume the command envelope
using [PR result and recovery rules](pr-management.md); an unknown write requires observation
before retry, while observation warnings do not undo a confirmed PR write.

For a fork, pass `--target-repository owner/repo` to each PR query/write. Omission means the origin
repository; fork metadata does not authorize publishing upstream. The PR base is independent of
the commit transaction's local Git baseline. Author the body in an ignored local file and preserve
user-authored content when updating an existing proposal.

After PR creation/update, use [review](../../review/SKILL.md) to check the current run. Do not start
a duplicate review for the same revision. Otherwise start review through its managed entrypoint.
Merge remains a human action. Report the commit, push and PR outcomes separately.

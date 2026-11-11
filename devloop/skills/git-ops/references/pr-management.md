# PR/MR management

Use the native provider-neutral CLI with the [shared result contract](../../../references/repocli.md#command-results-and-recovery):

```bash
repocli pr show <number> --repo <path> --json
repocli pr list --repo <path> --state open --json
repocli pr create --repo <path> --base <branch> --title '<title>' --body-file <file> --json
repocli pr update <number> --repo <path> --body-file <file> --json
repocli pr close <number> --repo <path> --json
```

Run `repocli validate` before publishing code or submitting its PR; inspect the results.
Pure title/body updates do not require validation. CLI commands do not run validation.
Select a fork destination explicitly with `--target-repository owner/repo`.
Forge access comes from RepoKit home config.json; do not inject token environment variables.
The AI invokes these write commands directly; devloop owns no access configuration.

Use [gcampr](commit-flow.md) for commit + push + create/reuse. Merge remains a human action.
Successful PR lifecycle writes perform best-effort local maintenance inside RepoKit; devloop supplies no
cleanup callback. Read queries do not clean worktrees.

Read PR identity and state from `data`, not envelope fields. A successful create/update with
maintenance warnings remains a confirmed PR write: report the PR URL and warnings, then
continue the requested workflow without recreating it. A partial result preserves completed
actions. For `unknown`, `error.uncertain`, or lost output after a write, query the same target
repository and head/base (or PR number) before retrying. If identity is ambiguous or the query
fails, leave the write unresolved rather than issuing another create/update. Use `pr show
<number> --max-age 0` to refresh a known PR; when creation returned no number, use `pr list
--head <branch> --state all` and verify source repository and base. Reconcile the requested
fields for an update or terminal state for a close, not just PR existence. An empty list only
proves absence when the query succeeded. Honor `retryAt` when present; do not infer safe
retries from error text.

## Discussions

Use repocli 0.67.0 or later for generic discussion operations:

```bash
repocli pr discussion list <number> --repo <path> --json
repocli pr discussion show <number> <thread-id> --repo <path> --json
repocli pr discussion create <number> --repo <path> --body-file <file> --json
repocli pr discussion reply <number> <thread-id> --repo <path> --body-file <file> --json
repocli pr discussion resolve <number> <thread-id> --repo <path> --json
```

Use the returned thread `id`; comment IDs in `comments[]` are distinct. `show` and JSON
preserve full Markdown and replies. `create` posts an unanchored conversation comment.
Check `replyable`, `resolvable` and `resolution`: GitHub conversation comments cannot be
replied to or resolved as review threads. For forks, pass the target repository explicitly.
These operations do not run worktree maintenance.

A successful reply returns the actual new comment ID and body. For an unknown write or lost
output, read the same PR/thread and compare the message/author or resolution before retrying.
Do not repeat a create/reply merely because its response was lost. A failed read is not absence.

A generic reply does not record a Verdict, and platform resolution does not establish that a
finding was fixed. For devloop findings use [review](../../review/SKILL.md): its domain commands
own Verdict encoding and the validated/published-fix requirement before resolution.

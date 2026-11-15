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
PR writes update affected observations. Worktree reclamation is explicit through `clean` or
`worktree clean`; it is not part of PR write latency.

Read PR identity and state from `data`, not envelope fields. A successful create/update with
observation warnings remains a confirmed PR write: report the PR URL and warnings, then
continue the requested workflow without recreating it. A partial result preserves completed
actions. For `unknown`, `error.uncertain`, or lost output after a write, query the same target
repository and head/base (or PR number) before retrying. If identity is ambiguous or the query
fails, leave the write unresolved rather than issuing another create/update. Use `pr show
<number> --max-age 0` to refresh a known PR; when creation returned no number, use `pr list
--head <branch> --state all` and verify source repository and base. Reconcile the requested
fields for an update or terminal state for a close, not just PR existence. An empty list only
proves absence when the query succeeded. Honor `retryAt` when present; do not infer safe
retries from error text.

## PR comments

Use repocli 0.88.0 or later:

```bash
repocli pr comment list <number> --repo <path> --json
repocli pr comment show <number> <comment-id> --repo <path> --json
repocli pr comment create <number> --repo <path> --body-file <file> --json
repocli pr comment reply <number> <comment-id> --repo <path> --body-file <file> --json
repocli pr comment update <number> <comment-id> --repo <path> --body-file <file> --json
repocli pr comment delete <number> <comment-id> --repo <path> --json
repocli pr comment resolve <number> <comment-id> --repo <path> --json
repocli pr comment unresolve <number> <comment-id> --repo <path> --json
```

The list is flat and counts every comment, including replies. Treat `id` and `reply_to_id`
as opaque public Comment IDs; never split them or substitute native thread/discussion handles.
`reply_to_id` is the platform-recoverable structural parent and can differ from the requested
reply target. `show` returns one comment; use `list` to read the surrounding conversation.
Creation accepts an optional `--anchor-file` with path, revision, side and optional line range.
For forks, pass the target repository explicitly. These operations do not run cleanup.

`resolution` is `unresolved`, `resolved`, `unsupported` or `unknown`; it describes platform
state and may apply to the containing conversation. It does not establish agreement or a fix.
Some comments cannot be replied to or resolved; the adapter reports unsupported operations.

For an unknown write or lost output, read the same PR and compare IDs, body, author and
resolution before retrying. Do not repeat a create/reply because its response was lost.
A failed read is not absence. Deletion does not authorize cascading deletion of replies.

Generic replies do not record Verdicts. For devloop findings use [review](../../review/SKILL.md):
its commands own the explicit target encoding and the published-fix requirement before resolution.

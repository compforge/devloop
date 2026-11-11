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
Credentials use `GH_TOKEN`/`GITHUB_TOKEN` or `GITLAB_TOKEN`; never put tokens in command arguments.
The AI invokes the CLI directly in an environment with these credentials; devloop does not launch it.

Use [gcampr](commit-flow.md) for commit + push + create/reuse. Merge remains a human action.
Successful PR writes perform best-effort local maintenance inside RepoKit; devloop supplies no
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

Review comments, replies, Verdicts and resolution retain their dedicated workflow:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py comment <number|url> <comment-id>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py reply <number> <comment-id> '<body>'
```

A generic reply does not record a Verdict or resolve a thread; use [review](../../review/SKILL.md).

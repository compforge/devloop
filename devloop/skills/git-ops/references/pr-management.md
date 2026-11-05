# PR/MR management

Use the native provider-neutral CLI (repocli >= 0.57.1):

```bash
repocli pr show <number> --repo <path> --json
repocli pr list --repo <path> --state open --json
repocli pr create --repo <path> --base <branch> --title '<title>' --body-file <file>
repocli pr update <number> --repo <path> --body-file <file>
repocli pr close <number> --repo <path>
```

Run `repocli validate` before publishing code or submitting its PR; inspect the results.
Pure title/body updates do not require validation. CLI commands do not run validation.
Select a fork destination explicitly with `--target-repository owner/repo`.
Credentials use `GH_TOKEN`/`GITHUB_TOKEN` or `GITLAB_TOKEN`; never put tokens in command arguments.
Managed gcampr supplies devloop's configured credentials to the same native CLI.

Use [gcampr](commit-flow.md) for commit + push + create/reuse. Merge remains a human action.
Successful PR writes perform best-effort local maintenance inside RepoKit; devloop supplies no
cleanup callback. Read queries do not clean worktrees.

Review comments, replies, Verdicts and resolution retain their dedicated workflow:

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py comment <number|url> <comment-id>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py reply <number> <comment-id> '<body>'
```

A generic reply does not record a Verdict or resolve a thread; use [review](../../review/SKILL.md).

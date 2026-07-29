---
name: git-ops
description: Commit, push, safely rebase an existing branch, create/read/update/close a pull/merge request (GitHub PR or GitLab MR), cut a feature branch, create/resume a managed worktree, or release. Triggers — gcam / gcamp / gcampr / rebase / 解决冲突 / 提 PR / 提 MR / pull request / merge request / 看 PR / 看 MR / 关 PR / 关 MR / checkout / worktree / 切新分支 / 起新分支 / 发版.
---

The umbrella for devloop's git + code-review workflow. All git goes through one runner
(`lib/gitcmd.py`); all code-review hosting through one facade (`lib/forge/`),
which picks GitHub or GitLab per-repo from the origin remote. You call the scripts below —
never raw `git commit/push` (the guards intercept those, and the scripts encode the case
logic + self-narrate a `PLAN:` banner you can trust), and **never hand-roll `curl`/`glab`/`gh`
against the forge API** — that one facade backs both script surfaces below (gcampr *raises* an
MR; `pr` *inspects/manages* an existing one) and resolves the token from config, so there's no
credentials file to hunt for.

Paths use `<PLUGIN_ROOT>` → `${CLAUDE_PLUGIN_ROOT}` on Claude Code; `${PLUGIN_ROOT}` on Codex.

## Operating principles

The scripts are the executable policy; this skill supplies the decision model. Inspect Git
state freely, but do not improvise a competing mutation sequence when devloop owns that
operation.

1. **Resolve intent before touching HEAD.** `--branch` means new work and cuts from a freshly
   fetched `origin/<target>`; omitting it means continue the current branch. Stacking is never
   inferred from the current checkout — it requires an explicit `--base`.
2. **Treat an existing identity as work to preserve.** Reusing a branch or worktree tag means
   resume it as-is, not “make it current.” Checkout must not silently rebase or reset existing
   work. Updating its baseline is a separate, explicit history operation.
3. **Revalidate shared state at the mutation boundary.** Injected branch/PR context is useful
   guidance, but the owning script's live fetch/forge/lease check is authoritative. If fresh
   state cannot be obtained, or changed underneath the transaction, stop rather than guess.
4. **Scope mutations to the user's change.** Target one repo and an explicit file set when
   untracked or unrelated files exist. Never trade convenience for a repo-wide `git add -A`;
   never let the current cwd silently choose another subproject.
5. **Rewrite history only as a resumable transaction.** Capture the old remote SHA before a
   rebase and publish with an exact `force-with-lease`. Never raw force-push, and never guess a
   reset target after the safe abort point has passed.
6. **Use hard gates only where no legitimate editing path exists.** Protected and inactive
   branches are denied. In-flight branches remain editable for review fixes, but new work must
   move to a new branch.
7. **Keep ownership boundaries explicit.** Commit/push/PR creation, checkout/worktree lifecycle,
   PR management, rebase, and release have separate owning entry points. Merge remains a human
   action. Trust and surface each owner's `PLAN:` or equivalent result.

## Commit / push / PR

| Intent | Script |
|--------|--------|
| commit only | `bash <PLUGIN_ROOT>/scripts/smart_gcam.sh --message "<msg>" [...]` |
| commit + push | `bash <PLUGIN_ROOT>/scripts/smart_gcamp.sh --message "<msg>" [...]` |
| commit + push + PR/MR | `bash <PLUGIN_ROOT>/scripts/smart_gcampr.sh --message "<msg>" [...]` |

**Message**: one-line / simple → inline single-quoted (`--message 'fix: …'`). Multi-line, or
containing quotes / `$` / backticks → use the **Write tool** to fully overwrite canonical
`<repo>/.devloop/commit_msg` (gitignored one-shot scratch), without reading/editing/patching its
previous contents, and pass `--message-file <path>` (alias `-F`; `-F -` reads stdin). The script
removes this canonical file on success and retains it on failure for retry. This avoids shell
escaping, mirroring `git commit -F` / `gh --body-file`; `--title` defaults to the first line.

Shared flags: `--repo <name|path>` (target repo; no `cd` prefix needed — default is
cwd's repo, falling back to the workspace's last-active repo), `--branch <name>`
(required when the context shows **PROTECTED** / **INACTIVE** — the script cuts a
fresh branch off `origin/<target>`), `--target <branch>`, `--files a,b` (explicit
staging, auto-rebased onto the repo root; else tracked modifications — never
`git add -A`), `--title "<PR title>"` (gcampr only). Trust the `PLAN:` banner; on
`✗`, fix per the message (usually add `--branch`) and retry. The `✗` for an
**INACTIVE / merged-or-closed** branch is computed from a live, authoritative forge poll and
quotes the MR's number / state / sha — so it's ground truth even right after you created the MR
(a colleague can merge it in seconds); add `--branch` and re-run.

## Checkout / managed worktree

Use ordinary `cd` to select an existing repo or checkout. When another session needs an isolated
checkout, use the managed helper instead of raw `git worktree add`:

```
python3 <PLUGIN_ROOT>/scripts/checkout.py <repo> --worktree <short-unique-tag>
```

A new tag creates `worktree-<tag>` from a freshly fetched `origin/<target>` and refuses creation
if that baseline cannot be refreshed. An existing worktree path or retained `worktree-<tag>`
branch is resumed without rebase/reset. Reuse the same tag only to continue that work; choose a
new tag for independent work from the latest target. Baseline updates to retained work are
explicit Git operations, never a side effect of checkout.

## Rebase an existing PR/MR branch

Rebase is its own resumable transaction — do **not** route it through gcamp/gcampr and do not
issue a raw force push. `start` captures the exact current remote source SHA *before* rewriting
history; `finish` uses that saved SHA in an explicit `--force-with-lease`, so a colleague's
intervening push fails closed instead of being overwritten.

```
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh start    --repo <name|path> [--target <branch>]
# resolve conflicts and git add the resolved files
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh continue --repo <name|path>  # repeat if needed
# run the relevant tests before publishing
bash <PLUGIN_ROOT>/scripts/smart_rebase.sh finish   --repo <name|path>
```

`--target` defaults to the open PR/MR's target, then the repo trunk. `start` and `continue`
treat conflicts as an expected paused state and print the next action. `finish` publishes the
already-rewritten commits, so it intentionally takes **no `--message`**. Its atomic push uses
`--force-with-lease=refs/heads/<branch>:<saved-old-sha>`.

Recovery/inspection: `smart_rebase.sh status --repo …`; while Git is still rebasing,
`smart_rebase.sh abort --repo …` runs `git rebase --abort` and clears the saved lease. After a
rebase has completed, abort refuses rather than guessing at a destructive reset target.

## 后台 code-review（自动，无需你操作）

启用了 `review` 的仓,commit 后 commit_flow 会**自动 detach 起后台 ocr review**(PLAN 出
`review: launched in background`)——**你不用起任何东西**。它跑完写 `.devloop/review.json`,
结果**下一轮**经注入上下文的 `Review:` 行浮现(`running` / `N finding(s)` / `clean`)。

看到 `Review: N finding(s)` 时:可读 `.devloop/review.json` 把问题按优先级(High/Medium/Low)
**简明通报**——这是「递信息」,**不打断 / 不挟持 session 的后续动作**,默认只通报不动手,仅
用户明确要才修。review 端到端 advisory(不挡 commit、不夺控制权),从不代替人 merge。完整
契约见 [`docs/code-review.md`](../../docs/code-review.md)。

## Inspect / manage a PR/MR — the `pr` CLI

One provider-neutral, config-driven surface for **inspecting / managing an existing** PR/MR
(token from env < `~/.devloop/config.json` < nearest `.devloop/config.json`). Raising a new one
is gcampr's job, above.

```
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py show     <number|url>      # state/branches/merge-readiness/comments
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py list     [--limit N] [--branch B]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py update   <number> --title "..." --description "..." --target-branch <b>
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py close    <number>          # close without merging
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py findings <number> [--pending]  # findings + 其 ccr:label verdict
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/pr.py reply    <number> <comment-id> "<body>"  # 回到某 comment 的线程
```

`findings` / `reply` 是打标闭环的读写两半;判定纪律（必须对照真实代码求证、四档词表）在
`label-review` skill,别绕开它自己编标准——那会让 ground truth 退化成"模型认同模型"。

There is no `pr create`: `pr` only ever operates on an MR that already exists and never touches
your working tree. Opening a new one is a commit+push transaction under the branch/staging gates
— that's gcampr, above.

## 发版 — the `release` CLI

Cut a versioned release over the same forge facade (GitHub Release / GitLab Release). The tag is
created **server-side** — no `git push --tags`, no working tree, no push guard in the way; and no
`--target <sha>` to mistype (a mistyped sha shipped a broken release before this existed).

```
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py create <version> [--target <ref>] [--title "..."] [--notes "..." | --notes-file <path>]
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/release.py latest                         # the current published release
```

- `<version>` must be **semver** (`vX.Y.Z`) and strictly greater than the last release — the CLI
  refuses a non-increment before calling the API.
- `--target` defaults to the repo's **trunk branch name**, so the forge tags that branch's current
  remote tip. Pass a branch/sha/tag only to release off something else.
- **Notes**: for anything beyond a one-liner, compose them yourself and pass `--notes-file <path>`
  (write it with the Write tool — no shell escaping; `-` reads stdin). With no `--notes`, a plain
  changelog is auto-drafted from PRs/MRs merged since the last release — a fallback, not a substitute
  for hand-written notes. `--title` defaults to the version.
- Shares `--repo <name|path>` with the scripts above. Since the tag lands on the remote, `git fetch
  --tags` locally afterward if you need it in the working copy.

This is **not** part of gcampr: releasing is a low-frequency, working-tree-free action, so it's a
peer of `pr` (forge-only), not a step in the commit→push→MR transaction.

## Branch / PR awareness

The injected `.devloop` context already carries the current branch's state, whether it's
protected, and a **Recent PRs** digest (the monitor keeps `prs` fresh; GitHub repos show
`PR #`, GitLab repos `MR !`). Read that before acting instead of re-querying git. The
branch's own PR is marked `*` in the digest; "INACTIVE" means its PR/MR is merged/closed —
cut a new branch before more edits.

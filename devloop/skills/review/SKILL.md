---
name: review
description: 'Manage devloop automated code-review runs and findings on GitHub/GitLab PRs/MRs: inspect or run a review, independently verify every published finding, record a Verdict, handle valid findings, resolve completed threads, or report missed findings. Use when Review/Review findings context surfaces, or the user asks to run review, process review comments/findings, review and fix, adjudicate, label, or 打标. Not for a direct architecture/code review without devloop artifacts; use code-taste for that.'
---

devloop review has one lifecycle:

```text
ReviewRun → Finding → Verdict → Handling → thread resolution
```

`ccr:label=` is only the Forge encoding of a Verdict. Never format it manually and never use
generic `pr reply` for adjudication; the review CLI validates the vocabulary and keeps recording a
Verdict separate from resolving the discussion.

`<PLUGIN_ROOT>` maps to `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Codex.

## Routes

### Surfaced ReviewRun result

When context contains `Review: ...`, treat it as advisory information, not control transfer:

- `running` → leave it alone;
- `stale` → report that the background run likely died and can be rerun;
- `clean` → no action;
- failed files / `error` → report incomplete coverage; never call it clean;
- findings → inspect the real diff/code before reporting them.

Use the Verdict vocabulary below instead of inventing a High/Medium/Low truth model. By default,
report the result briefly and return control. Modify code only when the user asks to fix or process
the findings.

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py status
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py run [--background '<context>']
```

Normal lifecycle hooks launch the same ReviewRun automatically; do not duplicate a visible
`running` run.

### Published Findings awaiting Verdicts

1. **List published Findings**:

   ```bash
   <PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py findings <n|url> --pending
   <PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py findings <n|url>
   ```

   每行是 `<comment-id>  [PENDING|verdict]  <path>[:<line>]  ccr:fp=<fp>`，`<comment-id>`
   就是下一步的定位符。GitLab/GitHub 同一套写法，不用分别拼 `gh api` / `glab api`。

   `.devloop/review.json` 只用于辅助求证；**仅存在本地、没发布成 comment 的 finding 不打标**
   ——它没有可回复的对象，采集侧也看不见。

2. **Adjudicate every pending Finding independently**:
   - 必须对照真实 diff/代码求证，**不能顺着 finding 文本信**——这是打标的头号失效模式：
     review 是模型写的，你也是模型，附和它会让 ground truth 退化成"模型认同模型"，
     整个评测基准就白做了；
   - 论证扎实但在实际执行路径上不成立的判 wrong（"教科书事实错套"是最常见误报形态）；
   - diff 之前已存在、不是本次改动引入的行为不算有效 finding，判 wrong 并用
     `#out-of-diff` 说明 attribution 反证；
   - 同一 MR 的更早 comment 已交付同一问题，判 repeat 并指向那条 comment；
   - 拿不准判 debatable，不要硬判。

3. **Record its Verdict without resolving the thread**:

   ```bash
   <PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py label <n> <comment-id> wrong \
     --reason '该分支实际走不到，xxx.py:42 已早返回 #textbook'
   ```

   `important` / `minor` describe validity and severity independently of whether a fix has already
   been made. The five Verdicts are:

   - `important`: valid, substantive defect;
   - `minor`: valid but small;
   - `debatable`: judgment call or defensive suggestion;
   - `wrong`: false positive with concrete counter-evidence;
   - `repeat`: already delivered by an earlier Finding in this PR/MR, with its comment id/link.

   理由里可带病因 tag：`#textbook` `#padding` `#out-of-diff` `#stale` `#cross-file`。

4. **Handle and resolve separately**:

   - `wrong` / `repeat` / `debatable`: the reason completes the no-code disposition; resolve it;
   - `important` / `minor`: modify code only when authorized, validate, publish through the normal
     git workflow, then resolve with `--fixed`;
   - a valid Finding whose fix is not yet published remains unresolved.

   ```bash
   <PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py resolve <n> <comment-id>
   <PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py resolve <n> <comment-id> --fixed
   ```

5. **收口**：再运行上述 `findings <n> --pending`，返回空即结束。不运行 ccr `eval/labels.py`，不手工修改
   `eval/labels/*.jsonl`，不在当前流程提交 ground truth；ground truth 由后续的集中采集任务
   统一查询 API 产生。

### Missed Finding

```bash
<PLUGIN_ROOT>/scripts/python <PLUGIN_ROOT>/scripts/review.py missed <n> \
  --path path/to/file.py --line 42 --reason '<concise evidence>'
```

## Boundaries

- Only independent replyable Finding threads carry Verdicts. Summary-note fallback text has no
  reply target and is excluded from `review findings`.
- Forge Finding + Verdict replies are the durable source for continuous-review history and later
  ground-truth collection. Do not edit local label datasets in this workflow.
- `review` owns ReviewRun/Finding/Verdict policy. Generic PR/MR show/update/close/reply stays in
  `git-ops`; commit/push and validation use their existing skills.
- Review remains advisory and never merges a PR/MR.

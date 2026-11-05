---
name: gcampr
description: Commit current changes, push, and create/reuse a pull/merge request (GitHub PR or GitLab MR). Use when the user says "gcampr" or asks to commit + push + open a PR/MR.
---

Follow [git-ops](../git-ops/SKILL.md) and its [commit flow](../git-ops/references/commit-flow.md).
The AI executes the sequence: `repocli validate`, the managed `smart_gcamp.sh` Git transaction,
then `repocli pr create` directly. Author the PR title/body from the final change and resolve its
base/destination explicitly. Check or launch review afterward; do not duplicate a running review.
Do not introduce a script or subprocess wrapper around these repocli commands.

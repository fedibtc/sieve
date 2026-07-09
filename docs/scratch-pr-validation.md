# Scratch PR Validation

Sticky PR comment validation needs a real scratch PR. The local `sieve` checkout currently has no GitHub remote configured, so this must run in a checkout with a real `origin` and a pushed branch.

Prerequisites:

- `gh auth status` succeeds with repo scope.
- The branch has an open GitHub PR.
- Sieve is running, or `SIEVE_TOKEN` is set for the target host.
- A review has already been published and you have its review id.

Validation:

```bash
sieve pr-comment <reviewId>
gh pr view --json comments --jq '.comments[] | select(.body | contains("<!-- sieve:<reviewId> -->")) | .body'
sieve pr-comment <reviewId>
gh pr view --json comments --jq '[.comments[] | select(.body | contains("<!-- sieve:<reviewId> -->"))] | length'
```

Expected result:

- First command creates one PR comment containing `<!-- sieve:<reviewId> -->`.
- Second command updates that same comment.
- Final count is `1`; no duplicate sticky comments are created.

The deterministic fake-`gh` create/update paths are covered by `cli/tests/agent_loop.rs`; this checklist covers the real GitHub API path.

## Local Validation

Validated on 2026-07-09 against scratch PR `daviroo/test#1` using local review `y2WoMUbJjV07`:

```bash
sieve --host http://localhost:3000 pr-comment y2WoMUbJjV07
sieve --host http://localhost:3000 pr-comment y2WoMUbJjV07
gh pr view --json comments --jq '[.comments[] | select(.body | contains("<!-- sieve:y2WoMUbJjV07 -->"))] | length'
```

Result:

- First run created GitHub issue comment `4924915054`.
- Second run updated the same comment.
- Final marker count was `1`.
- The scratch PR was closed and its branch was deleted after validation.

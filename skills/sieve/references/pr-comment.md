# Sticky PR Comment

Use this marker so repeated publishes edit the same pull-request comment:

```markdown
<!-- sieve:<reviewId> -->
Sieve recap: <reviewUrl>
```

## Create Or Update With `gh`

From the reviewed repo worktree:

```bash
review_id="<reviewId>"
review_url="<reviewUrl>"
marker="<!-- sieve:${review_id} -->"
body="${marker}
Sieve recap: ${review_url}"

pr_number="$(gh pr view --json number --jq .number)"
comment_id="$(gh api --paginate "repos/:owner/:repo/issues/${pr_number}/comments" \
  --jq ".[] | select(.body | contains(\"${marker}\")) | .id" | head -1)"

if [ -n "${comment_id}" ]; then
  gh api --method PATCH "repos/:owner/:repo/issues/comments/${comment_id}" \
    -f body="${body}"
else
  gh api --method POST "repos/:owner/:repo/issues/${pr_number}/comments" \
    -f body="${body}"
fi
```

If `gh pr view` fails because there is no PR, say so and skip the sticky comment.

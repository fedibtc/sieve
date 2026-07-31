# Getting a sieve review on any org repo

Reviews for fedibtc repos are triggered through the hub workflow in the fedi repo. The repo under review needs no workflow file, no secrets, and no setup.

The hub clones the PR branch, builds the newest sieve release, and publishes a review to `https://sieve.fedi.xyz` with a sticky PR comment linking it. When the hub has a model credential, an agent reads the diff and the surrounding code and authors the review: a claim about what the change does and whether it is safe or risky, findings with file and line, and an explicit list of what it verified and what it could not. Without the credential the hub publishes a mechanical recap of the diff instead.

## Trigger a review

On a fedi PR, comment:

```
@fedi-sieve
```

The tag works for commenters with write access, on fedi PRs only, because GitHub only delivers comment events to the repo hosting the workflow.

For every other org repo, dispatch the hub with the target repo and PR number:

```bash
gh workflow run sieve-hub-review.yml --repo fedibtc/fedi \
  -f repo=fedibtc/<name> -f pr_number=<n>
```

Dispatching needs actions write access on fedi. Draft state and CI state are ignored, so a review can be requested at any point in the PR's life. Re-triggering updates the same review and the same sticky comment in place.

## What is skipped

- fork PRs, since the hub's credentials never reach a fork's code
- closed PRs
- PRs with no diff against their base branch

## Where the pieces live

- `fedibtc/fedi/.github/workflows/sieve-hub-review.yml` is the hub. Its secrets (`SIEVE_TOKEN`, the fedi-sieve GitHub App credential, `ANTHROPIC_API_KEY`) live in fedi.
- the hub resolves the sieve CLI from this repo's newest release tag on every run, so cutting a release here is all it takes to change what the hub runs
- reviews land at `https://sieve.fedi.xyz/reviews/<id>`

A repo that wants a review published automatically on every PR push can instead call the reusable workflow in this repo (see `docs/reusable-review.md`). The hub is the default because it keeps target repos free of workflow files and secrets.

# Publishing sieve reviews on every PR push

Most repos should not use this. The default way to get a review on any org repo is the hub in fedi, which needs no workflow file or secrets in the target repo (see `docs/org-reviews.md`). The reusable workflow here is for a repo that wants a review published automatically on every PR push, and it publishes a mechanical recap of the diff rather than the agent-authored review the hub produces.

When a same-repo PR is opened or updated, a review is published from its diff and a sticky comment links it. Pushes update the same review in place. Fork PRs are skipped, since they get no secrets.

## Add the caller

Create `.github/workflows/sieve-review.yml` in your repo:

```yaml
name: 'Sieve review'

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: sieve-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    uses: fedibtc/sieve/.github/workflows/review.yml@v0.5.2
    with:
      sieve_version: v0.5.2
    secrets:
      SIEVE_TOKEN: ${{ secrets.SIEVE_TOKEN }}
```

## Setup

1. Add `SIEVE_TOKEN` as an org or repo secret, minted at `https://sieve.fedi.xyz/settings/tokens`.
2. Pin the `uses:` ref to a sieve release that ships this workflow.

## Inputs

Override the reusable workflow's defaults under `with:` if needed:

- `sieve_host` (default `https://sieve.fedi.xyz`)
- `sieve_version`: the release tag whose binary is installed. Pin it to the same release as the `uses:` ref, since the workflow default trails the newest release

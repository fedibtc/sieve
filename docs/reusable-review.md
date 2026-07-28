# Publishing sieve reviews on an org repo

Any repo in the org can publish sieve reviews by adding one caller workflow that delegates to the reusable workflow in this repo. Fedi runs its own NixOS review workflow; every other repo uses this.

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
    uses: fedibtc/sieve/.github/workflows/review.yml@v0.4.2
    secrets:
      SIEVE_TOKEN: ${{ secrets.SIEVE_TOKEN }}
```

## Setup

1. Add `SIEVE_TOKEN` as an org or repo secret, minted at `https://sieve.fedi.xyz/settings/tokens`.
2. Pin the `uses:` ref to a sieve release that ships this workflow.

## Inputs

Override the reusable workflow's defaults under `with:` if needed:

- `sieve_host` (default `https://sieve.fedi.xyz`)
- `sieve_version`: the release tag whose binary is installed (default `v0.4.2`, the first release shipping `sieve review-pr`)

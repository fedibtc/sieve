# Sieve

Sieve is a local-first review server and Rust CLI for structured agent review recaps, human feedback loops, and PR review handoff. Developers can ask an agent to "sieve this PR", have it publish a bounded recap with real git-derived context, then pull and close the feedback loop from the shell.

## Install The CLI

Sieve releases are private GitHub releases. Authenticate `gh`, fetch the installer, and run it from any repository:

```bash
gh auth status
installer="$(mktemp)"
gh api -H "Accept: application/vnd.github.raw+json" \
  repos/fedibtc/sieve/contents/scripts/install-sieve.sh > "$installer"
sh "$installer"
rm -f "$installer"
```

The installer detects macOS/Linux and the current CPU architecture, verifies the release checksum, and installs to `~/.local/bin`. Use `--version v0.2.0` to pin a release or `--install-dir /path/to/bin` to change the destination.

## Org Dev Quickstart

In a repo whose dev shell includes Sieve:

```bash
nix develop
sieve skill install
sieve status
```

Against a local Sieve server, `sieve status` works without a token because the local-dev auth bypass is intentional. For non-local hosts, mint a token in Sieve at `/settings/tokens`, export `SIEVE_TOKEN`, and pass `--host`.

See `docs/connect.md` for agent setup and `docs/fedi-dev-shell.md` for the fedi dev-shell integration shape.

## Local Dev

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/reviews`. Localhost uses the sanctioned local-dev auth bypass; production still requires Better Auth configuration.

By default the app stores data in `data/pglite`. Set `DATABASE_URL` to use Postgres.

## Useful Commands

```bash
pnpm check
pnpm seed
pnpm skill:install
pnpm db:migrate
```

`pnpm seed` creates the credential-app shaped demo review and comments. `pnpm skill:install` is the skill-author workflow for this repo: it live-links/copies the checkout skill into local agent dirs while editing. Normal agent setup should use `sieve skill install` so the installed skill matches the CLI binary.

## CLI And Agent Tokens

Build or run the Rust CLI through Nix:

```bash
nix build .#sieve
nix run .#sieve -- status
```

The `fedi` dev shell can expose this package directly. Repositories without Nix, including `credential-app`, should use the release installer. In either case, `sieve status` works against localhost without a token because the local-dev auth bypass is intentional.

Install or refresh the bundled agent skill once per machine:

```bash
sieve skill install
```

`sieve status` reports stale or missing installed skills and names the same fix.

See `docs/connect.md` for the full agent setup. Go to `/settings/tokens`, mint a token, and use one of the generated snippets:

- `sieve login --dev` to mint and store a localhost PAT for the CLI.
- `export SIEVE_TOKEN=sieve_...` for the CLI or scripts against non-local hosts.
- Deprecated `/api/mcp` snippets are still shown for migration only. New agent sessions should use the CLI.

Tokens are Better Auth API keys with the `sieve_` prefix, shown once, and revocable from the settings page.

## Publishing A Review

From a reviewed repo worktree, generate and edit a CLI manifest:

```bash
sieve scaffold --base master --head HEAD -o recap.json
sieve publish --manifest recap.json --dry-run
sieve publish --manifest recap.json
```

Before publishing, prune the draft to the recap contract in `skills/sieve/SKILL.md` and include the validation commands you actually ran.

For UI-facing credential-app branches, generate visual diff blocks. Localhost can use the dev auth bypass; non-local hosts need `SIEVE_TOKEN`:

```bash
node ~/.codex/skills/sieve/scripts/visual-diff-to-blocks.mjs --base master --head HEAD
```

The script captures showcase screenshots on the merge-base and branch, compares them with pinned `reg-cli@0.18.16`, uploads PNG attachments to Sieve, and prints `image-diff` blocks that can be spliced into the review content.

## Known Simplifications

Question-form answers are currently stored as anchored comments. The `answer` anchor field and question `mode`/`options` are reserved for structured answer capture later.

The `/api/mcp` route remains available for old sessions during migration, but it is frozen. The supported agent transport is the `sieve` CLI over `/api/agent/v1`.

## Cutting A CLI Release

GitHub Actions builds and publishes release binaries. Maintainers do not build or upload them locally.

1. Update `version` in `cli/Cargo.toml` and commit the change after CI passes.
2. Check the release plan with `nix develop --command nix run nixpkgs#cargo-dist -- plan --tag v0.2.0`.
3. Create and push the matching tag:

```bash
git tag -s v0.2.0
git push origin v0.2.0
```

`.github/workflows/release.yml` uses cargo-dist for native builds but uploads directly to a draft GitHub release because the organization does not currently have Actions artifact-storage capacity. Validate release configuration changes with:

```bash
nix develop --command nix run nixpkgs#cargo-dist -- plan --tag v0.2.0
```

The release workflow runs the reusable preflight checks, builds each configured OS/architecture target, creates checksums, and publishes the draft GitHub release only when every required job succeeds.

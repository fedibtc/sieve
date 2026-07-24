# Connect Agents

Sieve's supported agent transport is the `sieve` CLI. The CLI talks to `/api/agent/v1`, keeps tokens out of model-visible MCP config, validates manifests locally, and uses the same bearer path as attachment uploads.

## Localhost

Localhost intentionally supports tokenless agent requests for development:

```bash
sieve skill install
export SIEVE_HOST=http://localhost:7919
sieve status
```

The skill is embedded in the CLI. Run `sieve skill install` once per machine, and rerun it whenever `sieve status` reports the installed skill as missing or stale.

To exercise the bearer-token path locally without SSO:

```bash
sieve login --dev
sieve status
```

`login --dev` mints a real `sieve_` API key through `/api/tokens` and stores it in the CLI config file with private permissions.

## Non-Local Hosts

Mint a token at `/settings/tokens`, then set it in the shell environment used by the agent:

```bash
export SIEVE_TOKEN=sieve_...
sieve status
```

The CLI defaults to `https://sieve.fedi.xyz`. `--host` overrides both that
default and `SIEVE_HOST` for a single command. Do not pass tokens on argv; the
CLI deliberately has no `--token` flag.

## Production Authentication

The production domain must remain publicly reachable at Vercel's deployment
protection layer. Sieve's browser routes enforce a Better Auth session in the
application (production currently offers GitHub login), while `/api/agent/v1`,
`/api/attachments`, and the deprecated `/api/mcp` route enforce `sieve_` bearer
tokens in the application. Vercel Authentication is currently disabled for the
project. If it is enabled later, use Vercel Standard Protection so preview and
generated deployment URLs are protected while the custom production domain
remains public; protecting all production requests would intercept CLI calls
before Sieve can validate their tokens.

## Publishing Flow

From the repo being reviewed:

```bash
sieve scaffold --base master --head HEAD -o recap.json
sieve publish --manifest recap.json --dry-run
sieve publish --manifest recap.json
sieve feedback <reviewId>
```

Run `sieve policy show` before authoring and use it alongside the repository's own conventions. For UI changes, discover the repository's capture and comparison workflow, upload useful artifacts with `sieve attach`, and reference them in authored `image-diff` blocks. If important output is unavailable, publish an explicit warning with `--review-warning "<what is missing and why>"`.

## Integration Check

With `pnpm dev` already running, the CLI integration loop can be verified with:

```bash
SIEVE_TEST_SERVER=http://localhost:7919 \
  cargo test --manifest-path cli/Cargo.toml --test agent_loop -- --nocapture
```

The test is skipped when `SIEVE_TEST_SERVER` is unset, so normal `cargo test` stays hermetic. Do not run `pnpm seed` while `pnpm dev` is using PGlite.

For the broader CLI validation bundle:

```bash
pnpm validate:cli-plan
```

To include the temporary credential-app smoke recap and rendered review-page check:

```bash
CREDENTIAL_APP_PATH=/path/to/credential-app pnpm validate:cli-plan
```

The credential-app smoke check creates a temporary git worktree and branch, publishes a real recap through `sieve`, verifies the review page, then removes the temporary worktree and branch.

## Deprecated MCP Route

`/api/mcp` remains available only so existing Claude Code, Codex, and `mcp-remote` sessions do not break during migration. It is frozen and should not be used for new setup. Once team sessions are migrated, the route and `@modelcontextprotocol/sdk` dependency can be removed in a cleanup commit.

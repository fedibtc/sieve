# Connect Agents

Sieve's supported agent transport is the `sieve` CLI. The CLI talks to `/api/agent/v1`, keeps tokens out of model-visible MCP config, validates manifests locally, and uses the same bearer path as attachment uploads.

## Localhost

Localhost intentionally supports tokenless agent requests for development:

```bash
sieve skill install
sieve --host http://localhost:3000 status
```

The skill is embedded in the CLI. Run `sieve skill install` once per machine, and rerun it whenever `sieve status` reports the installed skill as missing or stale.

To exercise the bearer-token path locally without SSO:

```bash
sieve --host http://localhost:3000 login --dev
sieve --host http://localhost:3000 status
```

`login --dev` mints a real `sieve_` API key through `/api/tokens` and stores it in the CLI config file with private permissions.

## Non-Local Hosts

Mint a token at `/settings/tokens`, then set it in the shell environment used by the agent:

```bash
export SIEVE_TOKEN=sieve_...
sieve --host https://sieve.example.com status
```

Do not pass tokens on argv. The CLI deliberately has no `--token` flag.

## Publishing Flow

From the repo being reviewed:

```bash
sieve scaffold --base master --head HEAD -o recap.json
sieve publish --manifest recap.json --dry-run
sieve publish --manifest recap.json
sieve feedback <reviewId>
```

If the branch has UI changes, generate visual blocks with the skill's `visual-diff-to-blocks.mjs` helper and splice the returned `image-diff` blocks into `recap.json` before publishing.

## Integration Check

With `pnpm dev` already running, the CLI integration loop can be verified with:

```bash
SIEVE_TEST_SERVER=http://localhost:3000 \
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

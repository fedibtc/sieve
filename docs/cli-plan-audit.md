# CLI Implementation Audit

Current implementation evidence for the Sieve CLI transport.

Last validation evidence recorded on 2026-07-09.

## Verified Locally

- C1 REST surface and schema export: covered by `pnpm check`, route specs, schema sync, and shared block fixtures.
- C2 CLI core: covered by Rust unit tests plus `cli/tests/agent_loop.rs`.
- C3 protections: covered by Rust tests for schema validation, invariants, budgets, redaction, diff expansion, attachment checks, feedback framing, raw PNG upload, and PR comment upsert behavior.
- C4 local distribution: covered by `nix build .#sieve`, `nix run .#sieve -- status`, CLI-first skill/docs, token-page snippets, and removal of the old non-visual `diff-to-blocks` script.
- Live local loop: `pnpm validate:cli-plan` runs the local server loop through the CLI.
- Credential-app smoke recap: `CREDENTIAL_APP_PATH=/path/to/credential-app pnpm validate:cli-plan` creates a temporary credential-app worktree, publishes a real recap, verifies the review page, and cleans up.
- Sibling `fedi` dev-shell consumption: validated in a temporary `fedi` worktree with the coordinated `flake.nix` patch from `docs/fedi-dev-shell.md` and a local `--override-input sieve`.
- Codex CLI-only transport smoke: validated from this Codex session in a temporary sieve worktree using `sieve` for status, scaffold, dry-run publish, publish v1/v2, session start/end, feedback, comment, reply, resolve, consume, and PR-comment no-op.
- Global Codex skill install: `pnpm skill:install` refreshed `~/.codex/skills/sieve` to the CLI-first skill text.
- Codex full feedback loop: validated from this Codex session with CLI-only agent actions plus two human comments created through the normal localhost `/api/reviews/:id/comments` route (`createdBy: human`), covering one actionable agent-targeted thread and one human-targeted FYI thread.
- Claude Code full feedback loop: validated from a real Claude Code non-interactive session with CLI-only agent actions plus two human comments created externally through the normal localhost `/api/reviews/:id/comments` route (`createdBy: human`), covering one actionable agent-targeted thread and one human-targeted FYI thread.
- Real GitHub sticky PR comment: validated against scratch PR `daviroo/test#1` with real `gh` credentials; first `sieve pr-comment` created marker comment `4924915054`, second run updated the same comment, and the final marker count was `1`.
- Second-machine Nix run: validated on a GitHub Actions `ubuntu-latest` runner in `daviroo/sieve-nix-run-validation-1783599426`, run `29017640362`; `nix run .#sieve -- --help` built the CLI and printed the expected command surface.

## Latest Validation Run

Run from this repository with `pnpm dev` already serving `http://localhost:3000`:

```bash
pnpm check
pnpm validate:cli-plan
CREDENTIAL_APP_PATH=/path/to/credential-app pnpm validate:cli-plan
```

Results on 2026-07-09:

- `pnpm check`: 11 Vitest files, 40 tests passed.
- `pnpm validate:cli-plan`: Rust unit tests, Rust integration tests, clippy, `pnpm check`, `nix build .#sieve`, `nix run .#sieve -- status`, and the live CLI loop all passed.
- Credential-app smoke recap: published and rendered `http://localhost:3000/reviews/Y2DC_Miu4OTR`, then removed the temporary credential-app worktree and branch.
- Fedi dev shell: `nix develop /tmp/sieve-devshell.FaBsrb --override-input sieve "$SIEVE_CHECKOUT" --command sieve --host http://localhost:3000 status` built the shell and returned `local-dev-user` with `schemaDrift: false`.
- Codex CLI transport smoke: published `http://localhost:3000/reviews/UD3hz1Ddzbyz` from a temporary worktree branch, republished it as content version 2, registered and ended Codex session `AZfLsMVaPUym`, verified feedback partitioning, replied/resolved validation comment `Rs3LHNQVwUcc`, rendered the review page, and confirmed `pr-comment` skipped cleanly with no git remote.
- Codex full feedback loop: published `http://localhost:3000/reviews/MgWa_EgHWgB1`, added human actionable comment `b-QiUteqeHLJ` and human FYI comment `bqVTqGkh21Fl` via the non-agent comment route, verified `sieve feedback` returned 1 actionable, 1 FYI, and 0 detached threads, republished v2, replied to and resolved only the actionable thread, consumed both human comments, verified feedback was empty afterward, ended Codex session `WmKwAGyFmgyu`, rendered the review page, and confirmed `pr-comment` skipped cleanly with no git remote.
- Claude Code full feedback loop: Claude Code 2.1.205 published `http://localhost:3000/reviews/y2WoMUbJjV07`, started session `Kk2QxBH659b3`, external human comments `HL2JrxqRggri` (agent-targeted) and `qVlQoBb-JuUX` (FYI human-targeted) were added via the non-agent comment route, Claude fetched feedback through `sieve`, republished v2, replied to and resolved only `HL2JrxqRggri`, consumed both human comments, verified feedback was empty afterward, ended the session, rendered the review page, and confirmed `pr-comment` skipped cleanly with no git remote.
- Scratch PR sticky comment: created `https://github.com/daviroo/test/pull/1` from a temporary clone and branch, ran `sieve --host http://localhost:3000 pr-comment y2WoMUbJjV07` twice, observed create then update for GitHub issue comment `4924915054`, verified `gh pr view --json comments` returned exactly one `<!-- sieve:y2WoMUbJjV07 -->` marker comment, then closed the PR and deleted the scratch branch.
- Second-machine Nix run: pushed a temporary private validation repo to `daviroo/sieve-nix-run-validation-1783599426`; GitHub Actions run `29017640362` installed Nix 2.34.7 on `ubuntu-latest`, ran `nix run .#sieve -- --help`, built `sieve-0.1.0`, and printed `Sieve agent transport` plus the expected CLI commands.

## Rerun Command

```bash
pnpm validate:cli-plan
CREDENTIAL_APP_PATH=/path/to/credential-app pnpm validate:cli-plan
```

Run these with `pnpm dev` already serving Sieve. Do not run `pnpm seed` while `pnpm dev` is using PGlite.

## External Validation Still Required

None.

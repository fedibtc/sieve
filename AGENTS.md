# Repository Guidance For Codex

- Do not write machine-local absolute paths into committed docs or instructions. Use repo-relative paths, environment variables such as `$SIEVE_CHECKOUT`, or `/path/to/...` placeholders.
- Keep agent handoff plans and scratch planning notes out of the publishable tree. Use the ignored local `plans/` directory for that material.
- Run `pnpm check` before committing application changes.
- Run `pnpm test:e2e` before committing UI-affecting changes.
- Any change that adds or changes an interactive element must add or update its E2E element-map coverage and spec. Any change that adds or changes a user-facing capability must add or amend the corresponding journey test.
- Run the Rust/Nix CLI checks when touching `cli/`, `flake.nix`, schemas, or the agent transport:
  - `nix build .#sieve`
  - `nix run .#sieve -- --help`
  - `nix develop --command cargo test --manifest-path cli/Cargo.toml`
  - `nix develop --command cargo clippy --manifest-path cli/Cargo.toml --all-targets -- -D warnings`

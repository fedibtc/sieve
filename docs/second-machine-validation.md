# Second Machine Validation

The Sieve CLI flake should work with `nix run` on a second machine. This cannot be proven from the development machine that built the CLI, so this checklist records the exact external evidence needed.

## Prerequisites

- A separate macOS or Linux machine with Nix flakes enabled.
- Network access to the Sieve repository source used for distribution.
- If validating against a non-local Sieve host, a `SIEVE_TOKEN` minted from that host.
- If validating against localhost on that second machine, Sieve must also be running there.

## Commands

From a clean shell on the second machine:

```bash
nix --version
nix run github:<owner>/<repo>#sieve -- --help
```

For a deployed Sieve host:

```bash
export SIEVE_TOKEN=sieve_...
nix run github:<owner>/<repo>#sieve -- --host https://sieve.example.com status
```

For a local checkout copied or cloned onto the second machine:

```bash
git clone <sieve-repo-url> sieve
cd sieve
nix run .#sieve -- --help
nix run .#sieve -- --host http://localhost:3000 status
```

## Expected Evidence

- `nix run ... -- --help` prints the `sieve` command help without requiring a local Rust toolchain or Node install.
- `status` returns JSON with `host`, `hasToken`, `whoami`, `schemaDrift`, and `warnings`.
- `schemaDrift` is `false` when the second machine is running the same flake revision as the Sieve server.
- No token appears in argv, shell history snippets, or captured logs.

## Current Status

Validated on 2026-07-09 using a separate GitHub Actions `ubuntu-latest` runner:

- Temporary private validation repo: `daviroo/sieve-nix-run-validation-1783599426`
- Workflow run: `https://github.com/daviroo/sieve-nix-run-validation-1783599426/actions/runs/29017640362`
- Runner reported `nix (Nix) 2.34.7`.
- `nix run .#sieve -- --help` built `sieve-0.1.0` and printed the CLI help.
- The help output included `Sieve agent transport`, `Usage: sieve [OPTIONS] <COMMAND>`, and the expected command set including `status`, `scaffold`, `publish`, `feedback`, `session`, `attach`, and `pr-comment`.

This satisfies the explicit second-machine `nix run` requirement. The local machine had already passed `nix build .#sieve` and `nix run .#sieve -- --host http://localhost:3000 status`; the GitHub Actions run proves the flake also works on a clean external Linux machine.

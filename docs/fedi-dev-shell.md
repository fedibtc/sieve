# Fedi Dev Shell Integration

Sieve is designed to be consumed from the sibling `fedi` dev shell. That change belongs in the `fedi` repo, not this app repo. Do the integration as a coordinated branch there.

Minimal patch shape for `$FEDI_CHECKOUT/flake.nix`:

```nix
{
  inputs = {
    # ...
    sieve = {
      url = "github:fedibtc/sieve";
      inputs.nixpkgs.follows = "nixpkgs-unstable";
      inputs.flake-utils.follows = "flake-utils";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      nixpkgs-unstable,
      flake-utils,
      # ...
      sieve,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        # existing lets...
        sieveCli = sieve.packages.${system}.sieve;
      in
      {
        devShells = fmLib.devShells // {
          default = crossDevShell.overrideAttrs (prev: {
            nativeBuildInputs = prev.nativeBuildInputs ++ [
              sieveCli
            ];
          });
          # keep existing shells...
        };
      }
    );
}
```

If testing against this local checkout before the GitHub repo/input exists, use:

```bash
SIEVE_CHECKOUT=/path/to/sieve
FEDI_CHECKOUT=/path/to/fedi
nix develop "$FEDI_CHECKOUT" \
  --override-input sieve "$SIEVE_CHECKOUT" \
  --command sieve status
```

Expected result: `sieve status` resolves in the shell and reports the local Sieve user when `http://localhost:3000` is running.

The agent skill needs no flake wiring in `fedi`. It is embedded in the Sieve binary and installed explicitly:

```bash
sieve skill install
```

For validation without touching global agent dirs, install into a temporary target and compare it to this checkout:

```bash
tmp_skill="$(mktemp -d)/sieve"
sieve skill install --dir "$tmp_skill"
diff -r "$SIEVE_CHECKOUT/skills/sieve" "$tmp_skill" --exclude .sieve-skill.json
```

Do not add `SIEVE_TOKEN` to the flake. For localhost the auth bypass is intentional; for non-local hosts the agent shell should provide `SIEVE_TOKEN` through the environment.

## Local Validation

Validated on 2026-07-09 in a temporary `fedi` worktree with the patch shape above:

```bash
nix develop /tmp/sieve-fedi.0ZB45g \
  --override-input sieve "$SIEVE_CHECKOUT" \
  --command bash -lc 'sieve --host http://localhost:3000 status && tmp_skill="$(mktemp -d)/sieve" && sieve skill install --dir "$tmp_skill" && diff -r "$SIEVE_CHECKOUT/skills/sieve" "$tmp_skill" --exclude .sieve-skill.json && sieve skill status --dir "$tmp_skill"'
```

Result: the shell built with `sieve` available, returned the localhost dev user with `schemaDrift: false`, installed the embedded skill into a temporary directory byte-identical to `skills/sieve` excluding `.sieve-skill.json`, and reported the temporary skill state as `ok`. No fedi flake skill wiring was needed beyond adding the `sieve` CLI package to the shell.

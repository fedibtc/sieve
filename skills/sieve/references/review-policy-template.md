---
# Globs that mark a change as UI-facing. Declaring ui-paths makes Sieve's
# publish-time check blocking. Leave the key undeclared for the advisory common
# UI-path heuristic, or declare `ui-paths: []` to disable visual checks.
# ui-paths:
#   - "src/**/*.tsx"
#   - "src/**/*.css"
---

# Review Policy

Project-specific requirements for Sieve reviews of this repository. This file
is authoritative over the default policy printed by `sieve policy show`. Keep
it specific to this repository: validation commands, UI-facing paths, capture
methods, domain block mappings, and extra requirements.

## Validation gate

<!-- Name the exact commands an agent must run and report before publishing. -->

## Visual evidence

<!-- Explain how this repository captures deterministic before/after PNGs,
where they are written, how to capture the merge-base, and what to mask. End
with `sieve visual-diff --before <dir> --after <dir>`. -->

## Block mappings

<!-- Optionally map this repository's domain surfaces to preferred block types. -->

## Extra requirements

<!-- Add any other requirements for a good review of this project. -->

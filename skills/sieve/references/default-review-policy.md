# Sieve Default Review Policy

This is what a Sieve review must contain unless the project's own
`.sieve/review-policy.md` says otherwise. The project policy is authoritative
where they conflict. It can tighten or relax these requirements, but not the
skill's grounding rules: no fabricated evidence, no secrets, and no unverified
"true by construction" blocks.

## What a review is for

A reviewer must be able to assess what changed, why, the material risk, and the
proof without re-deriving the work. Every block must answer a reviewer question;
omit blocks that only record agent process.

## Validation

Run the project's validation gate before publishing: the commands named in the
project policy when present, otherwise the repository's own docs and CI
configuration. Report the exact commands and results in the summary. State a
failing or skipped gate plainly; never imply validation that did not run.

## Visual evidence for UI-facing changes

A change is UI-facing when it alters a human-visible rendered surface: screens,
components, styles, layout, theming, or iconography. The project policy may pin
exact paths with `ui-paths`. Without those paths, use the changed behavior and
repository conventions to decide.

Required artifact for each affected screen or state:

- Before and after PNG screenshots when the surface existed before, plus a
  computed pixel-diff overlay.
- After-only evidence for new surfaces; before-only for removed surfaces.
- Deterministic captures: both sides on the same machine, baseline at the
  merge-base, with dynamic content masked or frozen.

Choose the capture method in this order:

1. Instructions in the project policy.
2. The repository's existing screenshot, end-to-end, story, or preview harness.
3. An improvised deterministic capture using repository-appropriate tooling.

Once the PNGs exist, run `sieve visual-diff` with the before and after
directories to compute statuses and overlays, upload images, and emit
ready-to-splice `image-diff` blocks. Statuses come from pixel comparison, not
judgment. Use `sieve attach` plus hand-authored blocks only when directory
pairing cannot express the change.

If required visual evidence cannot be produced, do not present the recap as
complete. Say so in chat and publish with
`--allow-missing-visual-evidence <reason>`. The CLI adds a warning callout with
that reason to the published recap so reviewers can see what is missing. Never
fabricate, relabel, or hand-edit a comparison. Treat a flapping screen as a
determinism bug. Never publish screenshots containing real secrets or
credentials.

## Recap shape

Keep the title at 70 characters or less. Use this shape unless the diff is very
small:

1. A `summary` rich-text block with one to three short paragraphs covering what
   changed, why, material risk, and exact validation results.
2. For UI-facing work, `image-diff` blocks immediately after the outcome:
   changed screens first, then added, then removed. Cap around ten and include
   the omitted-screens note when capped.
3. Contract blocks (`data-model`, `api-endpoint`, `annotated-code`, or
   `mermaid`) before raw diffs when they explain the change better.
4. A `file-tree` for the complete changed-file footprint.
5. A `section` titled "Key changes" when more than one load-bearing surface is
   present, followed by one to five focused `diff` or `annotated-code` blocks.
6. An optional `question-form` only for a real open question.

## Block mapping defaults

- Schema or migration changes use `data-model` with `change` and `was` marks.
- API, route, action, worker message, or protocol changes use `api-endpoint`;
  request and response examples are each one valid JSON value.
- Every `diff` defaults to `mode: "split"` with a one-line `summary`;
  annotations belong on after-side lines, and large diffs need focused
  annotations.
- Brand-new files use `annotated-code`, not a one-sided split diff.
- Architecture or data-flow shifts use a genuinely two-dimensional `mermaid`
  diagram.
- Compatibility-sensitive changes get an adjacent `callout` with an
  appropriate `risk`, `warning`, `decision`, `info`, or `success` tone.
- Summaries describe intent and review value, not file status.

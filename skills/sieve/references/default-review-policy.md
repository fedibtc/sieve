# Sieve Default Review Guidance

This guidance helps an agent author a useful Sieve review. A repository's own
docs, CI configuration, and `.sieve/review-policy.md` can provide more specific
instructions. The Sieve CLI validates and publishes the authored review; it does
not mechanically enforce these editorial choices.

## What a review is for

Help a reviewer assess what changed, why, the material risk, and the available
proof without re-deriving the work. Prefer blocks that answer a reviewer
question; omit blocks that only record agent process.

## Validation

Discover and run the repository's validation gate before publishing. Report the
exact commands and results in the summary. State a failing or skipped gate
plainly; never imply validation that did not run.

## Visual evidence for UI-facing changes

Visual evidence is usually valuable when a change alters a human-visible
rendered surface. Determine the appropriate workflow from the repository's
guidance, scripts, CI, and existing screenshot, visual-regression, end-to-end,
story, or preview tooling. Capture and comparison methods differ by repository;
Sieve does not choose or execute them.

When the repository produces useful screenshots or comparisons, upload them
with `sieve attach` and reference the returned attachment IDs in authored
`image-diff` blocks. Only publish a comparison status or diff overlay when the
repository's actual tooling produced it. Do not fabricate, relabel, or hand-edit
a comparison, and never publish images containing real secrets or credentials.

When important evidence is unavailable, explain what is missing and why in
chat, and make that limitation visible to reviewers with a repeatable authored
warning:

```bash
sieve publish --manifest recap.json --review-warning "<what is missing and why>"
```

The flag publishes the supplied text as a warning callout. It is not a waiver,
and the CLI does not decide whether the evidence was required.

## Verdict recommendation and finding severity

The verdict callout accepts a machine-readable `recommendation`: `merge`, `merge-with-nits`, `needs-changes`, or `cannot-judge-alone`. The renderer badges it and derives the default fold state from it: on a merge recommendation every evidence card starts collapsed to its claim line, because nothing below the verdict is load-bearing for the decision.

Evidence blocks (`diff`, `annotated-code`, `rich-text`, `image-diff`) accept a `severity`: `blocking`, `minor`, or `fyi`. Blocking evidence renders open with a red mark. Minor and fyi evidence folds into a "Minor findings" group that shows only one-line claims, so write each block's `summary` as a claim the reader can act on without expanding the card.

- A finding that should change the merge decision is `blocking`.
- A finding worth recording but not acting on in this PR (dead code, misleading naming, style drift) is `minor`: one sentence in the summary at most, the folded card carries the mechanism.
- Verification narrative, the tracing that makes the verdict credible, belongs in a `rich-text` block with `severity: fyi` whose summary names the question it answers (for example "How the limit coupling was checked"). The renderer folds it; the summary prose should not restate it.

## Recap shape

A useful default shape is:

1. A verdict callout carrying a `recommendation`, then a short outcome summary covering what changed, why, material risk, and the validation that actually ran.
2. The scaffold's `change-shape` block: areas by directory sized by churn,
   derived mechanically from the diff. Keep it near the top so the reader
   sees the shape of the change before any detail; there is no reason to
   hand-author one.
3. Visual artifacts near the outcome when they materially help review.
4. Contract blocks (`data-model`, `api-endpoint`, `annotated-code`, or
   `mermaid`) before raw diffs when they explain the change better.
5. A `file-tree` for the complete changed-file footprint. `sieve review-pr`
   attaches each non-excluded file's full patch to its entry, so curated
   evidence never has to carry the whole diff.
6. A "Key changes" section with focused implementation evidence when several
   load-bearing surfaces changed.
7. An optional `question-form` only for a real open question.

## Block mapping defaults

- Schema or migration changes can use `data-model` with `change` and `was`
  marks.
- API, route, action, worker message, or protocol changes can use
  `api-endpoint`; request and response examples are each one valid JSON value.
- A `diff` is usually clearest in split mode with a one-line summary and focused
  annotations.
- Brand-new files are usually clearer as `annotated-code` than as one-sided
  diffs.
- Architecture or data-flow shifts can use a genuinely two-dimensional
  `mermaid` diagram.
- Compatibility-sensitive changes benefit from an adjacent `callout` with an
  appropriate tone.
- Summaries should describe intent and review value, not file status.

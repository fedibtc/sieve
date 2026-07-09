---
name: sieve
description: Publish structured review recaps, pull human feedback, and close the agent review loop through the sieve CLI.
---

# Sieve

Use this skill when working in a Fedi repo branch that should be reviewed through Sieve.

## Setup

1. Confirm `sieve` is available on `PATH`. It may be installed from a GitHub release or provided by the repo's Nix dev shell:

   ```bash
   sieve status
   ```

2. If `sieve status` warns that the installed skill is missing or stale, refresh it from the embedded CLI copy:

   ```bash
   sieve skill install
   ```

3. Localhost can use the sanctioned dev auth bypass with no token. To exercise the bearer path locally, run:

   ```bash
   sieve login --dev
   ```

4. For non-local hosts, use `SIEVE_TOKEN` or a stored CLI login token. Do not pass tokens on argv.

## Publish

Skip Sieve for trivial diffs where a normal chat summary is enough. Use it when the branch has reviewable shape: multiple files, contract changes, notable risk, or follow-up feedback.

1. Inspect the real git diff. Do not summarize from memory.
2. Run `sieve status`; note any schema drift warning before authoring blocks.
3. Run the repo validation gate yourself before publishing. For credential-app, use:

   ```bash
   pnpm check && pnpm test && pnpm test:worker && pnpm build
   ```

4. Generate a starter manifest from the repo worktree:

   ```bash
   sieve scaffold --base master --head HEAD -o recap.json
   ```

   The scaffold is a bounded candidate list, not a publishable recap. Edit `recap.json`: replace every placeholder summary with reviewer intent, remove evidence that is tiny or redundant, add annotations, and include exact validation results.

5. If the branch touches rendered UI (`src/**/*.tsx`, CSS, or showcase e2e specs), generate visual blocks:

   ```bash
   node scripts/visual-diff-to-blocks.mjs --base master --head HEAD
   ```

   If you are not running from the skill directory, locate the installed `sieve/scripts/visual-diff-to-blocks.mjs` and run that copy. Localhost can use the dev auth bypass; non-local hosts should use `SIEVE_TOKEN`. The script captures showcase screenshots locally on the merge-base and branch, compares them with `reg-cli@0.18.16`, uploads PNGs directly to Sieve, and prints ready-to-splice blocks. Skip this step for non-UI changes.

6. Dry-run publish before sending:

   ```bash
   sieve publish --manifest recap.json --dry-run
   ```

   Treat every review-quality warning as an authoring failure. Fix the manifest rather than publishing noisy context.

7. Publish with the same `idempotencyKey` for updates so the review becomes v2, v3, and so on:

   ```bash
   sieve publish --manifest recap.json
   ```

8. Surface the returned review URL in chat immediately.
9. Register the local agent session:

   ```bash
   sieve session start --review <reviewId>
   ```

10. If the branch has a PR, upsert a sticky PR comment:

   ```bash
   sieve pr-comment <reviewId>
   ```

The deliverable is the published Sieve recap, never an inline Markdown substitute. If the CLI or server is unavailable, fix the connection or say you cannot publish; do not degrade to pasting the recap into chat. The URL is the artifact because reviewers need the structured blocks, anchors, comments, and feedback loop.

## Recap Contract

Keep the title at 70 characters or less. Use this canonical shape unless the diff is very small:

1. `summary` rich-text block: 1-3 short paragraphs covering what changed, why, material risk, and exact validation results.
2. For UI-facing changes, put the `image-diff` blocks from `visual-diff-to-blocks.mjs` immediately after the outcome. They are the visual headline, not supporting evidence buried below code.
3. Contract blocks for important domain surfaces (`data-model`, `api-endpoint`, `annotated-code`, or `mermaid`) before raw diffs when they explain the change better.
4. `file-tree` block for the changed-file footprint.
5. `## Key changes` only when there is more than one load-bearing code surface, followed by focused `diff` / `annotated-code` blocks. Normally include 1-5 total; do not add blocks to meet a minimum.
6. Optional `question-form` only for real open questions. Do not ask the reviewer what validation ran; report your own validation results in the summary.

Never silently truncate a block. The `file-tree` is the complete footprint; do not add an omitted-files prose block that repeats it. Exclude lockfiles, generated assets, minified files, binaries, build output, and routine dependency manifests from key evidence unless that file is itself review-critical.

Cover the whole current work unit, not only the most recent tool call or fix. Include the original implementation, follow-up bug fixes, tests, docs, skill updates, and validation that belong to this thread. Exclude unrelated dirty edits that existed before the work. When republishing after feedback, keep the recap scoped to the whole work unit plus the correction; do not narrow it to only the last comment unless the user explicitly asks.

Keep the body lean, but not thin. Do not add a rich-text block just to say the recap is an aid, that reviewers should still read the diff, how many files changed, which ref generated it, how the recap was produced, what failed during capture, or what was masked by the screenshot harness. Prose exists for the objective, a real compatibility risk, an important decision, or a grounded review note. A recap that is worth publishing still needs a file-tree with change flags and focused implementation evidence for the load-bearing files.

Before authoring, make a short inventory of changed behavior and surfaces. Every visible block must answer at least one reviewer question:

- What behavior or contract changed?
- Why was that change made?
- What material risk or compatibility decision should I assess?
- What visual or code evidence proves the change?
- Is there a real decision or question that requires human input?

Omit a block when it only records agent process, troubleshooting history, recap-generation mechanics, provenance already present in review metadata, a routine dependency/lockfile update, or information already explained by another block. Cover the whole work unit by preserving all relevant outcomes, not by narrating every step the agent took.

For visual changes:

- Place the generated `image-diff` blocks directly after the outcome narrative for UI-facing work. The renderer labels them as visual comparisons; a separate `## Visual changes` prose heading is unnecessary.
- Use the script's top-level `summary` as a machine receipt only. Do not paste changed/added/removed counts, merge-base refs, platform, cache status, masking details, or capture troubleshooting into reviewer-facing prose. Baseline ref and platform remain attached to each `image-diff` block as structured metadata.
- Keep changed screens first, then added, then removed. Cap around 10 `image-diff` blocks; include the script's omitted-screen note when capped.
- Treat screenshots and verdicts as mechanical artifacts. Do not fabricate, edit, relabel, or describe a visual diff that the script did not produce.
- If a screen flaps between runs, fix the showcase masking/determinism first. Do not hand-wave the result.
- Do not publish screenshots that show real secrets, tokens, private keys, cookies, or credentials.

For credential-app, prefer these mappings:

| Changed surface | Preferred block |
| --- | --- |
| IndexedDB, persisted record shape, migration logic | `data-model` |
| QR payload parse/build/validation contracts (`*QrPayloads.ts`) | `api-endpoint` or `annotated-code` |
| WASM/native boundary, worker message protocol | `annotated-code` plus focused diff |
| User-visible verification or recovery flow | `mermaid` sequence plus focused diff |
| Property tests, fuzz cases, regression fixtures | focused diff with annotations |

Use these generic mapping rules outside credential-app:

- Schema or migration changes go in `data-model`. Mark each entity or field with `change: "added" | "modified" | "removed"` and use `was` for changed types or shapes. Use a literal SQL/code `diff` only when the exact statement is itself important.
- API, route, action, worker message, or protocol changes go in `api-endpoint`. Mark changed params with `change` and `was`; mark removed endpoints as removed in the endpoint `change`. Every request and response example must be one valid JSON value: no comments, no trailing commas, and no concatenated objects.
- Every `diff` defaults to `mode: "split"` and needs a one-line `summary`; never leave a diff unlabeled. Put annotations on the after-side line numbers by default, using before-side only for pure removals.
- Brand-new files or large added blocks with no meaningful before-side belong in `annotated-code`, not a one-sided split diff.
- Summaries describe intent and review value, not file status. Write "Makes the tabs root the page landmark", not "modified HolderMode.tsx"; write "Runs Axe over three holder states", not "added app-accessibility.spec.ts".
- Architecture or data-flow shifts belong in `mermaid` with a genuinely two-dimensional layout. Do not reduce structural changes to a left-to-right chain when a swimlane, layered graph, or before/after shape would be clearer.
- Compatibility-sensitive changes get a short `callout` beside the relevant block and should be explicitly marked breaking, risky, or non-breaking. Use `tone: "risk"` for compatibility hazards, `warning` for operational caution, `decision` for an intentional tradeoff, `info` for neutral context, and `success` for a validated positive outcome.

## Feedback Loop

Run `sieve feedback <reviewId>` before finishing, on resume, and after each fix batch.

If the feedback output says `reviewStatus` is `changes_requested`, treat that as "the human's pass is complete." Fix actionable feedback, validate, republish with the same idempotency key so the status returns to `open`, then reply/resolve/consume.

Follow the returned partition strictly:

- `targets`: primary grouped view by anchor/file/line, actionable-first. Use this to fix all comments touching the same target together.
- `actionableThreads`: agent-targeted work. Fix these when they are valid.
- `fyiThreads`: human-targeted information. Read and consume, but do not resolve.
- `detachedThreads`: anchors no longer match. Reconcile manually; do not ignore them.
- `resolvedThreads`: already resolved feedback that still may need consumption.
- `recentReviewEvents`: recent human-side status and comment events since publication/updates; use it as a delta narrative, not as a substitute for reading threads.

If a text quote or anchor could match more than one place, ask in the thread instead of guessing which instance the human meant. For `question-form` blocks, ask at most one form, place it at the bottom, honor `single`/`multi`/`freeform`, and do not re-ask a question that an earlier review version already asked.

After fixing actionable feedback:

1. Run the repo validation gate.
2. Publish the updated review with the same idempotency key.
3. Reply on each addressed thread with `sieve reply`.
4. Resolve each addressed agent-targeted thread with `sieve resolve`.
5. Call `sieve consume` with the `commentIds` returned by `sieve feedback` for everything read, including FYI. If the output lacks IDs, consume only currently unconsumed human feedback.

Never approve a review as an agent. Approval is human-only.

## Grounding Rules

- Review content must be derived from the current worktree, git diff, and validation commands.
- Structured blocks are true by construction only when they are built mechanically from the real diff: real paths, real fields, real methods and routes, real before/after text. Never infer or round these details. A confidently wrong recap is dangerous because a reviewer who trusts the summary may skip the line the summary got wrong. If the diff does not contain a fact, leave it out rather than guess.
- Do not include secrets, tokens, private keys, cookies, or credentials. Redact with obviously fake placeholders such as `sk-•••` or `<redacted>` in any block, caption, or note; never copy the real value and rely on the CLI redaction backstop.
- Prefer precise anchors: diff line anchors first, then file anchors, then block anchors.
- Use `resolutionTarget` as the only routing signal. Mentions are notification hints, not ownership.

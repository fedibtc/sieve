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

3. Read the available review guidance before authoring. The project section can document repository-specific validation commands, evidence workflows, and block mappings:

   ```bash
   sieve policy show
   ```

4. The CLI defaults to `https://sieve.fedi.xyz`. For local development, set
   `SIEVE_HOST`; localhost can use the sanctioned dev auth bypass with no token:

   ```bash
   export SIEVE_HOST=http://localhost:7919
   sieve status
   ```

   To exercise the bearer path locally, run:

   ```bash
   sieve login --dev
   ```

5. For interactive use against a non-local host, run the device flow:

   ```bash
   sieve login
   ```

   Open the printed verification URL, enter the user code, and approve the
   request from a GitHub-backed Sieve session. For headless agents and CI, mint
   a token at `/settings/tokens` and provide it as `SIEVE_TOKEN`. Never pass
   tokens on argv.

## Publish

Skip Sieve for trivial diffs where a normal chat summary is enough. Use it when the branch has reviewable shape: multiple files, contract changes, notable risk, or follow-up feedback.

1. Inspect the real git diff. Do not summarize from memory.
2. Run `sieve status`; note any schema drift warning before authoring blocks.
3. Run the repository's validation gate. Use its docs and CI configuration, plus any project guidance shown by `sieve policy show`, to discover the appropriate commands. Report the exact commands and results in the summary.

4. Generate a starter manifest from the repo worktree:

   ```bash
   sieve scaffold --base master --head HEAD -o recap.json
   ```

   The scaffold is a bounded candidate list, not a publishable recap. Edit `recap.json`: replace every placeholder summary with reviewer intent, remove evidence that is tiny or redundant, add annotations, and include exact validation results.

   The scaffold sets `"origin": "derived"`, which marks a mechanical recap. Once you author the recap, flip it to `"origin": "authored"` and set the top-level `summary` to a one-sentence claim about the change (what changed and why it is safe or risky). The server rejects an authored publish whose summary is missing or merely repeats the title, and the review page shows the origin and renders the claim under the title.

5. For UI-facing changes, determine how this repository produces visual evidence. Check project guidance, repository docs, package scripts, CI, and existing screenshot, visual-regression, end-to-end, story, or preview tooling. The developing agent owns that workflow; Sieve does not prescribe a capture or comparison command.

   Publish useful artifacts produced by that workflow with `sieve attach`, then reference the returned attachment IDs in authored blocks: screenshots in `image-diff`, WebM or MP4 recordings in `screen-recording`. For a before/after/diff screenshot trio, `sieve attach-diff before.png after.png diff.png --name <screen> --manifest recap.json` uploads all three and inserts a complete `image-diff` block directly under the verdict, so prefer it over three `attach` calls and a hand-written block. A comparison status or diff image must come from the repository's actual tooling; do not infer one from screenshots alone. `sieve attach` also accepts UTF-8 text files, stored as `text/x-patch` attachments that `file-tree` entries can reference through their `patch` field.

   If important review evidence is unavailable, say so in chat and make the limitation visible in the review:

   ```bash
   sieve publish --manifest recap.json --review-warning "<what is missing and why>"
   ```

   `--review-warning` is repeatable and publishes the supplied text as a warning callout. Sieve does not decide when a warning is needed or waive a repository requirement.

6. Dry-run publish before sending:

   ```bash
   sieve publish --manifest recap.json --dry-run
   ```

   Fix schema, grounding, attachment, or redaction problems before publishing.

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

Use the guidance printed by `sieve policy show` alongside the repository's own conventions. The default guidance suggests recap shape and generic block mappings; a project's `.sieve/review-policy.md` can explain what is useful for that codebase. Sieve publishes the result rather than mechanically enforcing those authoring choices.

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

Treat screenshots and comparison verdicts as mechanical artifacts. Do not fabricate, edit, relabel, or describe a visual comparison that the evidence did not produce. Fix flapping captures rather than hand-waving them, and never publish screenshots containing real secrets, tokens, keys, cookies, or credentials.

A `diff-ref` that expands beyond the CLI evidence limit is an authoring error, not permission to truncate. Replace it with a verified, focused literal `diff` containing exact text from the real before and after blobs.

Commands in this skill are always `sieve` subcommands. Real validation, capture, and comparison commands come from the repository's tooling and documentation.

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

## Auditing How A Review Was Constructed

When the question is why a review concluded what it did, read the run behind it rather than a CI log:

```bash
sieve versions <reviewId>                       # every published version
sieve versions <reviewId> --version <n>         # that version's content, plus its run
sieve run get <runId>                           # ordered steps, tokens, closing message
sieve run list --repo <owner/repo> --limit 20   # sweep the corpus
```

`finalMessage` on a run is where the agent stated what it graded and why, so read it first. A review published before run records existed has none, and for those only, fall back to the publishing job's CI log.

Record the run when you publish, so the next auditor does not hit that gap:

```bash
sieve publish --manifest sieve-recap.json --redact \
  --trace <agent-stream-json-transcript> --trace-prompt <prompt-file>
```

A run that died before publishing is the one worth keeping most, and publish cannot store it. Use `sieve run record --trace <transcript> --outcome failed`.

## Grounding Rules

- Review content must be derived from the current worktree, git diff, and validation commands.
- Structured blocks are true by construction only when they are built mechanically from the real diff: real paths, real fields, real methods and routes, real before/after text. Never infer or round these details. A confidently wrong recap is dangerous because a reviewer who trusts the summary may skip the line the summary got wrong. If the diff does not contain a fact, leave it out rather than guess.
- Do not include secrets, tokens, private keys, cookies, or credentials. Redact with obviously fake placeholders such as `sk-•••` or `<redacted>` in any block, caption, or note; never copy the real value and rely on the CLI redaction backstop.
- Prefer precise anchors: diff line anchors first, then file anchors, then block anchors.
- Use `resolutionTarget` as the only routing signal. Mentions are notification hints, not ownership.

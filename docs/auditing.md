# Auditing how a review was constructed

Sieve stores what a review said, what humans did to it, and how the reviewing agent got there: which model, which prompt, which files it opened in what order, and what it told itself before publishing.

Start here whenever the question is "why did this review conclude that". Do not reach for `gh run view --log`. It is the fallback for reviews published before run records existed, and it answers nothing the API cannot.

## The three calls

Every review page URL ends in the review id, so `https://sieve.fedi.xyz/reviews/PERMh_wJeLPk` is `PERMh_wJeLPk`.

```bash
sieve versions PERMh_wJeLPk              # every published version, newest first
sieve versions PERMh_wJeLPk --version 3  # that version's stored content, plus the run behind it
sieve run get <runId>                    # the run with its ordered steps
```

`sieve run list` sweeps the corpus rather than one review:

```bash
sieve run list --repo fedibtc/fedi --limit 20
sieve run list --outcome failed          # runs that never reached publish
sieve run list --trigger local           # runs someone published off a laptop
```

Every command takes `--json`. The underlying routes are under `/api/agent/v1`, so anything the CLI does you can also curl with a token.

## What a run holds

- **Provenance.** Model, the prompt's path and the sha256 of its contents, CLI version, agent version, trigger, hostname, repo, branch, head commit, start and end time. The prompt hash is what makes "was the prompt the same across these two runs" a comparison rather than an investigation.
- **Inputs.** Transcript size, how many lines failed to parse, and whatever the caller recorded about screenshots and prior human feedback.
- **Steps.** Ordered, typed, and queryable: tool name, target, truncated argument, the size of what came back, and whether it errored. Text steps carry the agent's own messages.
- **Outcome.** The terminal state, tool call count, permission denials, token counts, cost, and `finalMessage`. That last field is the agent's closing message, and it is usually the single most useful thing in the record: it is where an agent states what it graded and why.
- **Transcript.** The complete raw stream, uploaded as an attachment, redacted on the way in. Fetch it from `/api/attachments/<id>` when the steps are not enough.

## Answering the common questions

**Why did this review block the merge, or stop blocking it?**

```bash
sieve --json run get <runId> | jq -r '.run.finalMessage'
```

If the closing message does not say, read the text steps in order:

```bash
sieve --json run get <runId> | jq -r '.run.steps[] | select(.kind=="text") | .text'
```

**What changed between two versions of one review?**

```bash
sieve --json versions <reviewId> --version 3 > v3.json
sieve --json versions <reviewId> --version 4 > v4.json
diff <(jq -S '.version.content' v3.json) <(jq -S '.version.content' v4.json)
```

Then compare the two runs beside them. `promptSha256` differing means the prompt changed under the review. `promptSha256` matching means something else moved it.

**Did the agent read the thing it should have read?**

```bash
sieve --json run get <runId> | jq -r '.run.steps[] | select(.kind=="tool") | "\(.name) \(.target)"'
```

**Which reviews leaned on a repo rule file?**

```bash
sieve --json run list --repo fedibtc/fedi --limit 200 \
  | jq -r '.runs[].id' \
  | while read -r id; do
      sieve --json run get "$id" \
        | jq -r --arg id "$id" 'select([.run.steps[].target] | any(. != null and test("review-policy"))) | $id'
    done
```

## Recording a run

`sieve publish --trace <transcript>` records the run against the version it just published. The transcript is Claude Code's `--output-format stream-json` output, written to a file:

```bash
claude --print --verbose --output-format stream-json ... | tee "$workdir/agent-trace.jsonl" | jq ...
sieve publish --manifest sieve-recap.json --redact \
  --trace "$workdir/agent-trace.jsonl" \
  --trace-prompt scripts/ci/sieve-hub-agent-review.md
```

A run that never publishes is the one you most want later, and publish cannot record it because there is no publish. Record it directly:

```bash
sieve run record --trace "$workdir/agent-trace.jsonl" --outcome failed
```

Capture lives in the CLI rather than in any one pipeline, so a review published from a laptop is as auditable as one published from CI. `--trace-trigger` overrides the ci/local guess.

Steps and transcript are redacted harder than a published review. A review loses the needle of a secret, a trace loses the whole token, because raw tool output is not prose an agent chose to write. `--trace-no-transcript` keeps the steps and skips the upload.

## Reviews with no run record

A review published before run records existed has none, and nothing reconstructs one. When that review came from Fedi CI, the Actions log of the publishing job is what is left:

```bash
gh run list --repo fedibtc/fedi --workflow sieve-hub-review.yml --limit 50 \
  --json databaseId,createdAt,conclusion,displayTitle
gh run view <runId> --repo fedibtc/fedi --log | grep -n 'agent> \|agent: \|agent finished'
```

Tool calls appear as `agent> <Tool> <target>` and the agent's own messages as `agent: <text>`. Match a log to a review by the `Published https://sieve.fedi.xyz/reviews/<id>` line, not by timestamps. Two caveats: a run that GitHub labels `failure` may still have published, because the PR comment step runs after publish, and traces only reach the log at all for runs after 2026-08-11.

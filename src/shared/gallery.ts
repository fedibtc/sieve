import type { ReviewBlock } from "./blocks";

export type GalleryEntry = {
  slug: string;
  title: string;
  description: string;
  blocks: ReviewBlock[];
};

function contextLines(count: number, offset = 0) {
  return Array.from(
    { length: count },
    (_, index) =>
      `export const setting${index + offset + 1} = ${index + offset + 1};`,
  );
}

const longDiffBefore = [
  ...contextLines(14),
  'export const flag = "off";',
  ...contextLines(18, 14),
  "export const limit = 100;",
  ...contextLines(12, 32),
].join("\n");

const longDiffAfter = [
  ...contextLines(14),
  'export const flag = "on";',
  ...contextLines(18, 14),
  "export const limit = 250;",
  ...contextLines(12, 32),
].join("\n");

export const galleryEntries: GalleryEntry[] = [
  {
    slug: "rich-text",
    title: "Rich text",
    description:
      "Markdown prose with GFM tables. Text is selectable for quote anchors inside a review.",
    blocks: [
      {
        id: "gallery-rich-text",
        type: "rich-text",
        summary: "Outcome",
        data: {
          markdown:
            "## Outcome\nThis change tightens duration parsing and adds range validation.\n\n| Area | Files | Risk |\n| - | - | - |\n| parsing | 2 | low |\n| formatting | 1 | medium |\n\nInline `code`, **bold**, and [links](https://example.com) render here.",
        },
      },
    ],
  },
  {
    slug: "callouts",
    title: "Callouts",
    description: "One callout per tone.",
    blocks: (["info", "decision", "risk", "warning", "success"] as const).map(
      (tone) => ({
        id: `gallery-callout-${tone}`,
        type: "callout",
        summary: `${tone} callout`,
        data: {
          tone,
          markdown: `A **${tone}** callout with supporting detail for reviewers.`,
        },
      }),
    ),
  },
  {
    slug: "verdict-and-severity",
    title: "Verdict and severity",
    description:
      "A recommendation badge on the verdict, a minor finding that folds away, and an fyi appendix.",
    blocks: [
      {
        id: "gallery-verdict-recommendation",
        type: "callout",
        summary: "Verdict with a recommendation badge",
        data: {
          tone: "decision",
          markdown:
            "**The parser change is correct and the two findings below are cosmetic.** Nothing blocks the merge.",
          recommendation: "merge-with-nits",
        },
      },
      {
        id: "gallery-minor-diff",
        type: "diff",
        summary: "The fallback constant is dead: every caller passes a limit",
        severity: "minor",
        data: {
          filename: "src/lib/duration/parse.ts",
          language: "typescript",
          before: "const DEFAULT_LIMIT = 100;\nconst limit = 100;",
          after: "const DEFAULT_LIMIT = 100;\nconst limit = 250;",
          mode: "unified",
          annotations: [],
        },
      },
      {
        id: "gallery-fyi-appendix",
        type: "rich-text",
        summary: "How the limit coupling was checked",
        severity: "fyi",
        data: {
          markdown:
            "Every call site of `parseDuration` was traced: all four pass an explicit limit, so the constant change cannot alter parsed output anywhere.",
        },
      },
    ],
  },
  {
    slug: "change-shape",
    title: "Change shape",
    description: "Churn bars showing where a change lands.",
    blocks: [
      {
        id: "gallery-change-shape",
        type: "change-shape",
        summary: "Where the change lands",
        data: {
          areas: [
            {
              area: "src/lib/duration",
              files: 3,
              additions: 182,
              deletions: 44,
              change: "modified",
            },
            {
              area: "src/app/player",
              files: 2,
              additions: 51,
              deletions: 9,
              change: "modified",
            },
            {
              area: "e2e/specs",
              files: 1,
              additions: 30,
              deletions: 0,
              change: "added",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "file-tree",
    title: "File tree",
    description: "Changed files with per-file anchors and +/- stats.",
    blocks: [
      {
        id: "gallery-file-tree",
        type: "file-tree",
        summary: "Changed files",
        data: {
          entries: [
            {
              path: "src/lib/duration/format.ts",
              change: "modified",
              additions: 9,
              deletions: 3,
              note: "Range validation and zero-padded seconds.",
            },
            {
              path: "src/lib/duration/parse.ts",
              change: "modified",
              additions: 2,
              deletions: 1,
            },
            {
              path: "src/lib/duration/format.spec.ts",
              change: "added",
              additions: 41,
            },
            {
              path: "src/lib/legacy-format.ts",
              change: "removed",
              deletions: 28,
            },
          ],
        },
      },
    ],
  },
  {
    slug: "data-model",
    title: "Data model",
    description: "Entity cards with field-level change tones.",
    blocks: [
      {
        id: "gallery-data-model",
        type: "data-model",
        summary: "Track entity",
        data: {
          entities: [
            {
              name: "Track",
              change: "modified",
              fields: [
                {
                  name: "durationSeconds",
                  type: "number",
                  change: "modified",
                  was: "string",
                  note: "Stored as seconds instead of a preformatted label.",
                },
                {
                  name: "displayDuration",
                  type: "string",
                  change: "removed",
                },
                { name: "title", type: "string" },
              ],
            },
          ],
          relations: ["Playlist has many Tracks"],
        },
      },
    ],
  },
  {
    slug: "api-endpoints",
    title: "API endpoints",
    description: "Adjacent endpoint rows collapse into a compact stack.",
    blocks: [
      {
        id: "gallery-endpoint-list",
        type: "api-endpoint",
        summary: "List tracks with durations",
        data: {
          path: "/api/tracks",
          method: "GET",
          change: "modified",
          params: [
            {
              name: "format",
              type: '"seconds" | "label"',
              change: "added",
              note: "Chooses the duration representation.",
            },
          ],
          responses: [{ tracks: [{ id: "t1", durationSeconds: 214 }] }],
        },
      },
      {
        id: "gallery-endpoint-create",
        type: "api-endpoint",
        summary: "Create a track",
        data: {
          path: "/api/tracks",
          method: "POST",
          change: "added",
          params: [
            {
              name: "durationSeconds",
              type: "number",
              change: "added",
              note: "Must be a non-negative finite number.",
            },
          ],
          request: { title: "New track", durationSeconds: 214 },
          responses: [{ ok: true, id: "t2" }],
        },
      },
    ],
  },
  {
    slug: "diff-annotated",
    title: "Diff with annotations",
    description:
      "Split/unified diff with authored annotations on both sides, including modified lines.",
    blocks: [
      {
        id: "gallery-diff-annotated",
        type: "diff",
        summary: "Duration formatting hardening",
        data: {
          filename: "src/lib/duration/format.ts",
          language: "ts",
          mode: "split",
          before: `export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return \`\${minutes}:\${seconds}\`;
}

export function parseDuration(value: string) {
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}`,
          after: `export function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    throw new RangeError(\`invalid duration: \${totalSeconds}\`);
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return \`\${minutes}:\${String(seconds).padStart(2, "0")}\`;
}

export function parseDuration(value: string) {
  const [minutes = 0, seconds = 0] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}`,
          annotations: [
            {
              side: "after",
              lines: "2-3",
              label: "input validation",
              note: "Non-finite and negative inputs now fail fast instead of rendering NaN labels.",
            },
            {
              side: "after",
              lines: "6-7",
              label: "seconds formatting",
              note: "Fractional seconds are floored and zero-padded so 65.5s renders as 1:05.",
            },
            {
              side: "before",
              lines: "8",
              label: "silent NaN",
              note: 'The old destructuring produced NaN for single-segment values like "90".',
            },
          ],
        },
      },
    ],
  },
  {
    slug: "diff-one-sided",
    title: "One-sided diff",
    description:
      "An added file renders unified with the full code surface and no empty pane.",
    blocks: [
      {
        id: "gallery-diff-one-sided",
        type: "diff",
        summary: "New spec for duration formatting",
        data: {
          filename: "src/lib/duration/format.spec.ts",
          language: "ts",
          mode: "split",
          before: "",
          after: `import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("zero-pads seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  it("rejects negative durations", () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
  });
});`,
          annotations: [
            {
              side: "after",
              lines: "5-7",
              label: "padding coverage",
              note: "Locks in the zero-padding behavior from the formatting change.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "diff-long",
    title: "Long diff with collapsed context",
    description:
      "Two small changes far apart; unchanged runs collapse behind expanders.",
    blocks: [
      {
        id: "gallery-diff-long",
        type: "diff",
        summary: "Settings churn",
        data: {
          filename: "src/lib/settings.ts",
          language: "ts",
          mode: "unified",
          before: longDiffBefore,
          after: longDiffAfter,
          annotations: [
            {
              side: "after",
              lines: "34",
              label: "raised limit",
              note: "The limit increase is the risky part of this change.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "annotated-code",
    title: "Annotated code",
    description:
      "Plain code block with annotations and a show-all expander past 30 lines.",
    blocks: [
      {
        id: "gallery-annotated-code",
        type: "annotated-code",
        summary: "Retry loop",
        data: {
          filename: "src/lib/retry.ts",
          language: "ts",
          startLine: 1,
          code: [
            "export async function withRetry<T>(",
            "  operation: () => Promise<T>,",
            "  attempts = 3,",
            "): Promise<T> {",
            "  let lastError: unknown;",
            "  for (let attempt = 1; attempt <= attempts; attempt += 1) {",
            "    try {",
            "      return await operation();",
            "    } catch (error) {",
            "      lastError = error;",
            "      await delay(2 ** attempt * 100);",
            "    }",
            "  }",
            "  throw lastError;",
            "}",
            "",
            "function delay(ms: number) {",
            "  return new Promise((resolve) => setTimeout(resolve, ms));",
            "}",
            ...contextLines(16, 100),
          ].join("\n"),
          annotations: [
            {
              side: "after",
              lines: "6-13",
              label: "backoff loop",
              note: "Exponential backoff starting at 200ms; attempt 3 waits 800ms.",
            },
            {
              side: "after",
              lines: "14",
              label: "error propagation",
              note: "The final failure rethrows the last underlying error.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "key-changes-tabs",
    title: "Key changes tabs",
    description:
      "A “Key changes” section followed by diff and code blocks groups into tabs.",
    blocks: [
      {
        id: "gallery-key-changes",
        type: "section",
        data: { title: "Key changes" },
      },
      {
        id: "gallery-key-diff-format",
        type: "diff",
        summary: "Formatting",
        data: {
          filename: "src/lib/duration/format.ts",
          language: "ts",
          mode: "split",
          before: "const label = `${minutes}:${seconds}`;\n",
          after:
            'const label = `${minutes}:${String(seconds).padStart(2, "0")}`;\n',
          annotations: [],
        },
      },
      {
        id: "gallery-key-diff-parse",
        type: "diff",
        summary: "Parsing",
        data: {
          filename: "src/lib/duration/parse.ts",
          language: "ts",
          mode: "split",
          before: 'const [minutes, seconds] = value.split(":").map(Number);\n',
          after:
            'const [minutes = 0, seconds = 0] = value.split(":").map(Number);\n',
          annotations: [],
        },
      },
      {
        id: "gallery-key-code-spec",
        type: "annotated-code",
        summary: "Coverage",
        data: {
          filename: "src/lib/duration/format.spec.ts",
          language: "ts",
          startLine: 1,
          code: 'it("zero-pads seconds", () => {\n  expect(formatDuration(65)).toBe("1:05");\n});',
          annotations: [],
        },
      },
    ],
  },
  {
    slug: "mermaid",
    title: "Mermaid diagram",
    description: "Rendered client-side with sanitized SVG and an expander.",
    blocks: [
      {
        id: "gallery-mermaid",
        type: "mermaid",
        summary: "Parse flow",
        data: {
          caption: "Duration parsing path",
          source:
            "flowchart LR\n  A[raw value] --> B{has colon?}\n  B -- yes --> C[split minutes/seconds]\n  B -- no --> D[treat as seconds]\n  C --> E[total seconds]\n  D --> E",
        },
      },
    ],
  },
  {
    slug: "question-form",
    title: "Question form",
    description:
      "Single, multi, and freeform questions posting anchored answers.",
    blocks: [
      {
        id: "gallery-questions",
        type: "question-form",
        summary: "Open review questions",
        data: {
          questions: [
            {
              id: "gallery-q-single",
              prompt: "Should invalid durations throw or clamp to zero?",
              mode: "single",
              options: ["throw", "clamp", "unsure"],
            },
            {
              id: "gallery-q-multi",
              prompt: "Which follow-ups are worth filing?",
              mode: "multi",
              options: ["fuzz tests", "locale formats", "none"],
            },
            {
              id: "gallery-q-free",
              prompt: "Anything else the agent should know?",
              mode: "freeform",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "image-diff",
    title: "Image diff",
    description:
      "Visual comparison chrome. Media needs real attachments, so panels show as unavailable in the gallery.",
    blocks: [
      {
        id: "gallery-image-diff",
        type: "image-diff",
        summary: "Player screenshot",
        data: {
          name: "player-controls",
          status: "changed",
          before: {
            attachmentId: "gallery-missing-before",
            width: 800,
            height: 500,
          },
          after: {
            attachmentId: "gallery-missing-after",
            width: 800,
            height: 500,
          },
          diff: {
            attachmentId: "gallery-missing-diff",
            width: 800,
            height: 500,
          },
          baseline: { ref: "main", platform: "chromium" },
        },
      },
    ],
  },
  {
    slug: "screen-recording",
    title: "Screen recording",
    description:
      "Recording chrome. The video needs a real attachment, so playback is unavailable in the gallery.",
    blocks: [
      {
        id: "gallery-screen-recording",
        type: "screen-recording",
        summary: "Journey evidence",
        data: {
          attachmentId: "gallery-missing-recording",
          title: "Reviewer journey",
          caption: "The recording walks the duration formatting change.",
        },
      },
    ],
  },
];

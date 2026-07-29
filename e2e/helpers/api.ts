import { type APIRequestContext, expect } from "@playwright/test";
import { nanoid } from "nanoid";

export type ReviewBlock = Record<string, unknown>;

export async function whoami(request: APIRequestContext, token?: string) {
  return request.get("/api/agent/v1/whoami", {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

export async function publishFixtureReview(
  request: APIRequestContext,
  input: {
    title?: string;
    repo?: string;
    blocks?: ReviewBlock[];
    idempotencyKey?: string;
    origin?: "authored" | "derived";
  } = {},
) {
  const key = input.idempotencyKey ?? `e2e:${nanoid()}`;
  const response = await request.post("/api/agent/v1/reviews", {
    data: {
      title: input.title ?? `E2E review ${key}`,
      summary: "E2E fixture review",
      origin: input.origin ?? "authored",
      repo: input.repo ?? "e2e/review-helper",
      branch: "codex/e2e",
      baseRef: "main",
      headSha: key,
      prNumber: 123,
      prUrl: "https://example.com/e2e/pull/123",
      idempotencyKey: key,
      agentName: "codex",
      changeNote: "E2E fixture publish",
      content: {
        version: 1,
        blocks: input.blocks ?? basicBlocks(),
      },
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as {
    review: { id: string; status: string; contentVersion: number };
    url: string;
  };
}

export async function addBrowserComment(
  request: APIRequestContext,
  reviewId: string,
  data: {
    message: string;
    anchor?: Record<string, unknown> | null;
    resolutionTarget?: "agent" | "human";
    parentCommentId?: string | null;
  },
) {
  const response = await request.post(`/api/reviews/${reviewId}/comments`, {
    data,
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function getFeedback(
  request: APIRequestContext,
  reviewId: string,
) {
  const response = await request.get(
    `/api/agent/v1/reviews/${reviewId}/feedback`,
  );
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function agentReply(
  request: APIRequestContext,
  reviewId: string,
  commentId: string,
  message = "Fixed in the follow-up revision.",
) {
  const response = await request.post(
    `/api/agent/v1/reviews/${reviewId}/comments/${commentId}/replies`,
    { data: { message } },
  );
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function agentResolve(
  request: APIRequestContext,
  reviewId: string,
  commentId: string,
) {
  const response = await request.post(
    `/api/agent/v1/reviews/${reviewId}/comments/${commentId}/resolve`,
    { data: { message: "Resolved after applying the requested change." } },
  );
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function agentConsume(
  request: APIRequestContext,
  reviewId: string,
  commentIds: string[],
) {
  const response = await request.post(
    `/api/agent/v1/reviews/${reviewId}/feedback/consume`,
    { data: { commentIds } },
  );
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function uploadPng(
  request: APIRequestContext,
  bytes = oneByOnePng,
) {
  const response = await request.post("/api/attachments", {
    headers: { "content-type": "image/png" },
    data: bytes,
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

export function basicBlocks(): ReviewBlock[] {
  return [
    {
      id: "summary",
      type: "rich-text",
      summary: "Outcome",
      data: { markdown: "## Outcome\nA concise E2E fixture review." },
    },
    {
      id: "fixture-diff",
      type: "diff",
      summary: "Fixture diff",
      data: {
        filename: "src/example.ts",
        language: "ts",
        before: "export const value = 1;\n",
        after: "export const value = 2;\n",
        annotations: [],
      },
    },
  ];
}

export function allBlockTypes(): ReviewBlock[] {
  return [
    {
      id: "rich",
      type: "rich-text",
      summary: "Markdown",
      data: { markdown: "## Markdown\n| A | B |\n| - | - |\n| 1 | 2 |" },
    },
    ...["info", "decision", "risk", "warning", "success"].map((tone) => ({
      id: `callout-${tone}`,
      type: "callout",
      summary: `${tone} callout`,
      data: { tone, markdown: `A ${tone} callout.` },
    })),
    {
      id: "shape",
      type: "change-shape",
      summary: "Where the change lands",
      data: {
        areas: [
          {
            area: "src/app",
            files: 2,
            additions: 180,
            deletions: 50,
            change: "modified",
          },
          {
            area: "scripts/ci",
            files: 1,
            additions: 30,
            deletions: 0,
            change: "added",
          },
        ],
      },
    },
    {
      id: "tree",
      type: "file-tree",
      summary: "Files",
      data: {
        entries: [
          { path: "src/a.ts", change: "added", additions: 3 },
          { path: "src/b.ts", change: "modified", additions: 1, deletions: 1 },
        ],
      },
    },
    {
      id: "model",
      type: "data-model",
      summary: "Model",
      data: {
        entities: [
          {
            name: "Review",
            change: "modified",
            fields: [
              {
                name: "status",
                type: "open | approved",
                was: "open",
                note: "This note is selectable text.",
              },
            ],
          },
        ],
        relations: ["Review has comments"],
      },
    },
    {
      id: "selectable-rich",
      type: "rich-text",
      summary: "Selectable text",
      data: { markdown: "This rich note can be selected." },
    },
    {
      id: "endpoint",
      type: "api-endpoint",
      summary: "Endpoint",
      data: {
        path: "/api/e2e",
        method: "POST",
        change: "added",
        params: [{ name: "id", type: "string", note: "Review id" }],
        request: { id: "r1" },
        responses: [{ ok: true }],
      },
    },
    {
      id: "code",
      type: "annotated-code",
      summary: "Code",
      data: {
        filename: "src/example.ts",
        language: "ts",
        startLine: 1,
        code: Array.from(
          { length: 36 },
          (_, index) => `line${index + 1}();`,
        ).join("\n"),
        annotations: [{ side: "after", lines: "3-4", note: "Important lines" }],
      },
    },
    {
      id: "diff",
      type: "diff",
      summary: "Long diff",
      data: {
        filename: "src/example.ts",
        language: "ts",
        before: longText("old"),
        after: longText("new"),
        annotations: [{ side: "after", lines: "10", note: "Changed behavior" }],
      },
    },
    {
      id: "diagram",
      type: "mermaid",
      summary: "Diagram",
      data: {
        caption: "E2E diagram",
        source: "flowchart TD\n  A[Start] --> B[Finish]",
      },
    },
    {
      id: "questions",
      type: "question-form",
      summary: "Questions",
      data: {
        questions: [
          {
            id: "single",
            prompt: "Pick one option",
            mode: "single",
            options: ["yes", "no"],
          },
          {
            id: "multi",
            prompt: "Pick many options",
            mode: "multi",
            options: ["a", "b"],
          },
          { id: "free", prompt: "Explain the result", mode: "freeform" },
        ],
      },
    },
  ];
}

export function keyChangesGroup(): ReviewBlock[] {
  return [
    {
      id: "summary",
      type: "rich-text",
      summary: "Summary",
      data: { markdown: "## Summary\nGrouped key changes fixture." },
    },
    {
      id: "key-changes",
      type: "section",
      data: { title: "Key changes" },
    },
    {
      id: "key-diff-one",
      type: "diff",
      summary: "First file",
      data: {
        filename: "src/one.ts",
        language: "ts",
        before: "const one = false;\n",
        after: "const one = true;\n",
        annotations: [],
      },
    },
    {
      id: "key-code-two",
      type: "annotated-code",
      summary: "Second file",
      data: {
        filename: "src/two.ts",
        language: "ts",
        code: "export const two = true;\n",
        annotations: [],
      },
    },
  ];
}

export function maliciousMermaid(): ReviewBlock[] {
  return [
    {
      id: "bad-mermaid",
      type: "mermaid",
      summary: "Malicious diagram",
      data: {
        source:
          'flowchart TD\nA["<script>alert(1)</script>"] --> B["<foreignObject>bad</foreignObject>"]',
      },
    },
  ];
}

function longText(prefix: string) {
  return Array.from({ length: 32 }, (_, index) => `${prefix} line ${index + 1}`)
    .join("\n")
    .concat("\n");
}

const oneByOnePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgaGAAAAKAAZqHf4pYAAAAAElFTkSuQmCC",
  "base64",
);

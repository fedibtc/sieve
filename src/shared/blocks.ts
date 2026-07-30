import { z } from "zod";
import { anchorSchema } from "./anchors";

const annotationSchema = z.object({
  side: z.enum(["before", "after"]).default("after"),
  lines: z.string().regex(/^\d+(-\d+)?$/),
  label: z.string().optional(),
  note: z.string().min(1),
});

const richTextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("rich-text"),
  summary: z.string().optional(),
  data: z.object({
    markdown: z.string().min(1),
  }),
});

const sectionBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("section"),
  summary: z.string().optional(),
  data: z.object({
    title: z.string().trim().min(1).max(80),
  }),
});

const calloutBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("callout"),
  summary: z.string().optional(),
  data: z.object({
    tone: z.enum(["info", "decision", "risk", "warning", "success"]),
    markdown: z.string().min(1),
  }),
});

const patchRefSchema = z.object({
  attachmentId: z.string().min(1),
  lines: z.number().int().positive(),
});

const fileTreeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("file-tree"),
  summary: z.string().optional(),
  data: z.object({
    entries: z
      .array(
        z.object({
          path: z.string().min(1),
          change: z.enum(["added", "modified", "removed", "renamed"]),
          additions: z.number().int().nonnegative().optional(),
          deletions: z.number().int().nonnegative().optional(),
          note: z.string().optional(),
          patch: patchRefSchema.optional(),
        }),
      )
      .min(1),
  }),
});

const diffBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("diff"),
  summary: z.string().optional(),
  data: z.object({
    filename: z.string().min(1),
    language: z.string().optional(),
    before: z.string(),
    after: z.string(),
    beforeStartLine: z.number().int().positive().optional(),
    afterStartLine: z.number().int().positive().optional(),
    mode: z.enum(["split", "unified"]).default("split"),
    annotations: z.array(annotationSchema).default([]),
  }),
});

const annotatedCodeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("annotated-code"),
  summary: z.string().optional(),
  data: z.object({
    filename: z.string().min(1),
    language: z.string().optional(),
    code: z.string().min(1),
    startLine: z.number().int().positive().default(1),
    annotations: z.array(annotationSchema).default([]),
  }),
});

const dataModelBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("data-model"),
  summary: z.string().optional(),
  data: z.object({
    entities: z
      .array(
        z.object({
          name: z.string().min(1),
          change: z.enum(["added", "modified", "removed"]).optional(),
          fields: z.array(
            z.object({
              name: z.string().min(1),
              type: z.string().optional(),
              change: z.enum(["added", "modified", "removed"]).optional(),
              was: z.string().optional(),
              note: z.string().optional(),
            }),
          ),
        }),
      )
      .min(1),
    relations: z.array(z.string()).optional(),
  }),
});

const apiEndpointBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("api-endpoint"),
  summary: z.string().optional(),
  data: z.object({
    path: z.string().min(1),
    method: z.string().optional(),
    change: z.enum(["added", "modified", "removed"]).optional(),
    params: z.array(
      z.object({
        name: z.string().min(1),
        type: z.string().optional(),
        change: z.enum(["added", "modified", "removed"]).optional(),
        was: z.string().optional(),
        note: z.string().optional(),
      }),
    ),
    request: z.unknown().optional(),
    responses: z.array(z.unknown()).optional(),
  }),
});

const changeShapeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("change-shape"),
  summary: z.string().optional(),
  data: z.object({
    areas: z
      .array(
        z.object({
          area: z.string().min(1),
          files: z.number().int().positive(),
          additions: z.number().int().nonnegative(),
          deletions: z.number().int().nonnegative(),
          change: z.enum(["added", "modified", "removed"]),
        }),
      )
      .min(1),
  }),
});

const mermaidBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("mermaid"),
  summary: z.string().optional(),
  data: z.object({
    source: z.string().min(1),
    caption: z.string().optional(),
  }),
});

const questionFormBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("question-form"),
  summary: z.string().optional(),
  data: z.object({
    questions: z
      .array(
        z.object({
          id: z.string().min(1),
          prompt: z.string().min(1),
          mode: z.enum(["single", "multi", "freeform"]),
          options: z.array(z.string().min(1)).optional(),
        }),
      )
      .min(1),
  }),
});

const imageRefSchema = z.object({
  attachmentId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const imageDiffBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("image-diff"),
    summary: z.string().optional(),
    data: z.object({
      name: z.string().min(1).max(120),
      status: z.enum(["changed", "added", "removed"]),
      before: imageRefSchema.optional(),
      after: imageRefSchema.optional(),
      diff: imageRefSchema.optional(),
      baseline: z
        .object({
          ref: z.string().min(1),
          platform: z.string().min(1),
        })
        .optional(),
    }),
  })
  .superRefine((block, ctx) => {
    const { status, before, after, diff } = block.data;
    if ((status === "changed" || status === "removed") && !before) {
      ctx.addIssue({
        code: "custom",
        message: `${status} image-diff blocks require before`,
        path: ["data", "before"],
      });
    }
    if ((status === "changed" || status === "added") && !after) {
      ctx.addIssue({
        code: "custom",
        message: `${status} image-diff blocks require after`,
        path: ["data", "after"],
      });
    }
    if (status === "changed" && !diff) {
      ctx.addIssue({
        code: "custom",
        message: "changed image-diff blocks require diff",
        path: ["data", "diff"],
      });
    }
    if (status === "added" && before) {
      ctx.addIssue({
        code: "custom",
        message: "added image-diff blocks cannot include before",
        path: ["data", "before"],
      });
    }
    if (status === "removed" && after) {
      ctx.addIssue({
        code: "custom",
        message: "removed image-diff blocks cannot include after",
        path: ["data", "after"],
      });
    }
    if (status !== "changed" && diff) {
      ctx.addIssue({
        code: "custom",
        message: "only changed image-diff blocks can include diff",
        path: ["data", "diff"],
      });
    }
  });

export const blockSchema = z.discriminatedUnion("type", [
  richTextBlockSchema,
  sectionBlockSchema,
  calloutBlockSchema,
  fileTreeBlockSchema,
  diffBlockSchema,
  annotatedCodeBlockSchema,
  dataModelBlockSchema,
  apiEndpointBlockSchema,
  changeShapeBlockSchema,
  mermaidBlockSchema,
  questionFormBlockSchema,
  imageDiffBlockSchema,
]);

export const reviewDocumentSchema = z
  .object({
    version: z.literal(1),
    blocks: z.array(blockSchema).min(1).max(120),
  })
  .superRefine((document, ctx) => {
    const ids = new Set<string>();
    for (const [index, block] of document.blocks.entries()) {
      if (ids.has(block.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate block id: ${block.id}`,
          path: ["blocks", index, "id"],
        });
      }
      ids.add(block.id);
      for (const [annotationIndex, annotation] of ("annotations" in block.data
        ? block.data.annotations
        : []
      ).entries()) {
        const maxLine = annotationMaxLine(block, annotation.side);
        const [start, end = start] = annotation.lines.split("-").map(Number);
        if (start > maxLine || end > maxLine) {
          ctx.addIssue({
            code: "custom",
            message: `Annotation lines out of range for block ${block.id}`,
            path: [
              "blocks",
              index,
              "data",
              "annotations",
              annotationIndex,
              "lines",
            ],
          });
        }
      }
    }

    const bytes = new TextEncoder().encode(JSON.stringify(document)).length;
    if (bytes > 2_000_000) {
      ctx.addIssue({
        code: "custom",
        message: "Review content exceeds the 2 MB limit",
        path: ["blocks"],
      });
    }
  });

function annotationMaxLine(
  block: z.infer<typeof blockSchema>,
  side: "before" | "after",
) {
  if (block.type === "annotated-code") {
    return block.data.startLine + block.data.code.split("\n").length - 1;
  }
  if (block.type === "diff") {
    const text = side === "before" ? block.data.before : block.data.after;
    const start =
      side === "before"
        ? (block.data.beforeStartLine ?? 1)
        : (block.data.afterStartLine ?? 1);
    return start + text.split("\n").length - 1;
  }
  return Number.POSITIVE_INFINITY;
}

export const anchoredCommentInputSchema = z.object({
  message: z.string().min(1).max(20_000),
  anchor: anchorSchema.nullable().default(null),
  resolutionTarget: z.enum(["agent", "human"]).default("agent"),
  answer: z.string().optional(),
});

export type ReviewDocument = z.infer<typeof reviewDocumentSchema>;
export type ReviewBlock = z.infer<typeof blockSchema>;

export function collectAttachmentIds(document: ReviewDocument) {
  const ids = new Set<string>();
  for (const block of document.blocks) {
    if (block.type === "image-diff") {
      for (const ref of [
        block.data.before,
        block.data.after,
        block.data.diff,
      ]) {
        if (ref) {
          ids.add(ref.attachmentId);
        }
      }
    }
    if (block.type === "file-tree") {
      for (const entry of block.data.entries) {
        if (entry.patch) {
          ids.add(entry.patch.attachmentId);
        }
      }
    }
  }
  return [...ids];
}

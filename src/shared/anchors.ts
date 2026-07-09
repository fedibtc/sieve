import { z } from "zod";

export const textQuoteSchema = z.object({
  quote: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
});

export const lineAnchorSchema = z.object({
  side: z.enum(["before", "after"]),
  start: z.number().int().positive(),
  end: z.number().int().positive().optional(),
});

export const anchorSchema = z.object({
  blockId: z.string().min(1),
  kind: z.enum(["block", "text", "line", "file", "question"]),
  textQuote: textQuoteSchema.optional(),
  line: lineAnchorSchema.optional(),
  filePath: z.string().optional(),
  questionId: z.string().optional(),
  answer: z.string().optional(),
});

export type ReviewAnchor = z.infer<typeof anchorSchema>;

export function getAnchorLabel(anchor: ReviewAnchor | null) {
  if (!anchor) {
    return "Review";
  }

  if (anchor.kind === "line" && anchor.line) {
    const end = anchor.line.end ? `-${anchor.line.end}` : "";
    return `${anchor.filePath ?? anchor.blockId} ${anchor.line.side}:${anchor.line.start}${end}`;
  }

  if (anchor.kind === "question" && anchor.questionId) {
    return `Question ${anchor.questionId}`;
  }

  if (anchor.kind === "file" && anchor.filePath) {
    return anchor.filePath;
  }

  if (anchor.textQuote?.quote) {
    return `"${anchor.textQuote.quote.slice(0, 80)}"`;
  }

  return anchor.blockId;
}

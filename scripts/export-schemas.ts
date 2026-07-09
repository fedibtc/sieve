import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  commentInput,
  consumeFeedbackInput,
  endSessionInput,
  listReviewsInput,
  publishReviewInput,
  replyInput,
  resolveInput,
  reviewIdInput,
  sessionInput,
  statusInput,
} from "@/server/agent/schemas";
import { anchorSchema } from "@/shared/anchors";
import { blockSchema, reviewDocumentSchema } from "@/shared/blocks";

const root = process.cwd();
const schemaDir = join(root, "schemas");

const schemas = {
  "anchor.schema.json": anchorSchema,
  "block.schema.json": blockSchema,
  "review-document.schema.json": reviewDocumentSchema,
  "agent-comment-input.schema.json": commentInput,
  "agent-consume-feedback-input.schema.json": consumeFeedbackInput,
  "agent-end-session-input.schema.json": endSessionInput,
  "agent-list-reviews-input.schema.json": listReviewsInput,
  "agent-publish-review-input.schema.json": publishReviewInput,
  "agent-reply-input.schema.json": replyInput,
  "agent-resolve-input.schema.json": resolveInput,
  "agent-review-id-input.schema.json": reviewIdInput,
  "agent-session-input.schema.json": sessionInput,
  "agent-status-input.schema.json": statusInput,
};

async function main() {
  await mkdir(schemaDir, { recursive: true });

  for (const [filename, schema] of Object.entries(schemas)) {
    const jsonSchema = z.toJSONSchema(schema, {
      target: "draft-2020-12",
    });
    await writeFile(
      join(schemaDir, filename),
      `${JSON.stringify(jsonSchema, null, 2)}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { deflateSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { comments, reviews } from "@/server/db/schema";
import { createPngAttachment } from "@/server/services/attachments";
import { createComment } from "@/server/services/comments";
import { upsertReview } from "@/server/services/reviews";
import { ensureUser } from "@/server/services/users";
import type { ReviewDocument } from "@/shared/blocks";
import { credentialAppSeedReview } from "@/shared/fixtures";

const SCREENSHOT_WIDTH = 960;
const SCREENSHOT_HEIGHT = 560;

async function main() {
  await getDb();
  const agent = await ensureUser({
    id: "seed-agent-user",
    name: "Codex Fixture Agent",
    email: "codex-fixture@localhost",
    emailVerified: true,
  });
  const reviewer = await ensureUser({
    id: "local-dev-user",
    name: "Local Dev",
    email: "local-dev@localhost",
    emailVerified: true,
  });
  const visualRefs = await createSeedVisualAttachments(agent.id);
  const seedContent = withSeedVisualDiff(credentialAppSeedReview, visualRefs);

  const review = await upsertReview({
    id: "seed-credential-app-qr",
    title: "Credential-app QR property coverage",
    summary:
      "Seeded M2 recap from credential-app master...codex/property-qr-tests.",
    origin: "authored",
    repo: "fedibtc/credential-app",
    branch: "codex/property-qr-tests",
    baseRef: "master",
    headSha: "codex/property-qr-tests",
    content: seedContent,
    idempotencyKey: "seed:credential-app:codex-property-qr-tests",
    createdByUserId: agent.id,
    agentName: "codex",
    changeNote: "M2 fixture seed",
  });
  const db = await getDb();
  await db.delete(comments).where(eq(comments.reviewId, review.id));
  await db
    .update(reviews)
    .set({ status: "open", updatedAt: new Date() })
    .where(eq(reviews.id, review.id));

  await createComment({
    reviewId: review.id,
    authorUserId: reviewer.id,
    createdBy: "human",
    message:
      "Please double-check whether issuer activity can become stale if QR rendering fails after recordSharedOffer.",
    anchor: {
      blockId: "issuer-flow-diff",
      kind: "line",
      filePath: "src/features/issuer/GiveBadgeFlow.tsx",
      line: { side: "after", start: 3 },
    },
    resolutionTarget: "agent",
  });

  await createComment({
    reviewId: review.id,
    authorUserId: reviewer.id,
    createdBy: "human",
    message:
      "This validation question should stay visible for the human reviewer.",
    anchor: {
      blockId: "review-questions",
      kind: "question",
      questionId: "q-validation-gate",
    },
    resolutionTarget: "human",
  });

  console.log(`Seeded review: /reviews/${review.id}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function createSeedVisualAttachments(createdByUserId: string) {
  const before = await createPngAttachment({
    createdByUserId,
    data: makeSeedScreenshot("before"),
  });
  const after = await createPngAttachment({
    createdByUserId,
    data: makeSeedScreenshot("after"),
  });
  const diff = await createPngAttachment({
    createdByUserId,
    data: makeSeedScreenshot("diff"),
  });

  return {
    before: attachmentRef(before.attachment),
    after: attachmentRef(after.attachment),
    diff: attachmentRef(diff.attachment),
  };
}

function attachmentRef(attachment: {
  id: string;
  width: number | null;
  height: number | null;
}) {
  if (attachment.width === null || attachment.height === null) {
    throw new Error("seed attachments are PNGs and always carry dimensions");
  }
  return {
    attachmentId: attachment.id,
    width: attachment.width,
    height: attachment.height,
  };
}

function withSeedVisualDiff(
  document: ReviewDocument,
  refs: Awaited<ReturnType<typeof createSeedVisualAttachments>>,
): ReviewDocument {
  return {
    ...document,
    blocks: [
      document.blocks[0],
      {
        id: "visual-diff-credential-acceptance",
        type: "image-diff",
        data: {
          name: "credential-acceptance",
          status: "changed",
          before: refs.before,
          after: refs.after,
          diff: refs.diff,
          baseline: {
            ref: "merge-base@4663431",
            platform: "darwin-arm64",
          },
        },
      },
      ...document.blocks.slice(1),
    ],
  };
}

function makeSeedScreenshot(kind: "before" | "after" | "diff") {
  const image = new Raster(
    SCREENSHOT_WIDTH,
    SCREENSHOT_HEIGHT,
    [248, 250, 252],
  );
  image.rect(0, 0, SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT, [248, 250, 252]);
  image.rect(0, 0, SCREENSHOT_WIDTH, 64, [255, 255, 255]);
  image.rect(0, 63, SCREENSHOT_WIDTH, 1, [226, 232, 240]);
  image.rect(48, 24, 128, 16, [17, 24, 39]);
  image.rect(748, 22, 72, 20, [226, 232, 240]);
  image.rect(840, 22, 72, 20, [226, 232, 240]);

  image.rect(64, 104, 328, 344, [255, 255, 255]);
  image.border(64, 104, 328, 344, [226, 232, 240]);
  image.rect(96, 136, 156, 18, [17, 24, 39]);
  image.rect(96, 170, 240, 12, [148, 163, 184]);
  image.rect(96, 194, 210, 12, [203, 213, 225]);
  image.rect(96, 240, 232, 232, [241, 245, 249]);
  image.border(96, 240, 232, 232, [203, 213, 225]);

  image.rect(448, 104, 448, 344, [255, 255, 255]);
  image.border(448, 104, 448, 344, [226, 232, 240]);
  image.rect(480, 136, 176, 18, [17, 24, 39]);
  image.rect(480, 170, 280, 12, [148, 163, 184]);
  image.rect(480, 210, 352, 52, [241, 245, 249]);
  image.border(480, 210, 352, 52, [203, 213, 225]);
  image.rect(504, 230, 108, 12, [71, 85, 105]);

  if (kind === "before") {
    image.rect(480, 300, 192, 44, [37, 99, 235]);
    image.rect(520, 316, 112, 12, [219, 234, 254]);
    image.rect(96, 300, 120, 32, [226, 232, 240]);
  } else {
    image.rect(480, 292, 192, 44, [22, 163, 74]);
    image.rect(520, 308, 112, 12, [220, 252, 231]);
    image.rect(96, 292, 120, 32, [254, 243, 199]);
    image.border(96, 292, 120, 32, [245, 158, 11]);
    image.rect(96, 342, 184, 32, [226, 232, 240]);
  }

  if (kind === "diff") {
    image.tint([255, 255, 255], 0.62);
    image.rect(94, 290, 124, 36, [251, 191, 36]);
    image.border(94, 290, 124, 36, [217, 119, 6]);
    image.rect(478, 290, 196, 56, [248, 113, 113]);
    image.border(478, 290, 196, 56, [220, 38, 38]);
    image.rect(94, 340, 188, 36, [34, 197, 94]);
    image.border(94, 340, 188, 36, [22, 101, 52]);
  }

  return encodePng(image.width, image.height, image.data);
}

class Raster {
  readonly data: Buffer;

  constructor(
    readonly width: number,
    readonly height: number,
    background: [number, number, number],
  ) {
    this.data = Buffer.alloc(width * height * 3);
    this.rect(0, 0, width, height, background);
  }

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number],
  ) {
    for (
      let yy = Math.max(0, y);
      yy < Math.min(this.height, y + height);
      yy += 1
    ) {
      for (
        let xx = Math.max(0, x);
        xx < Math.min(this.width, x + width);
        xx += 1
      ) {
        const offset = (yy * this.width + xx) * 3;
        this.data[offset] = color[0];
        this.data[offset + 1] = color[1];
        this.data[offset + 2] = color[2];
      }
    }
  }

  border(
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number],
  ) {
    this.rect(x, y, width, 1, color);
    this.rect(x, y + height - 1, width, 1, color);
    this.rect(x, y, 1, height, color);
    this.rect(x + width - 1, y, 1, height, color);
  }

  tint(color: [number, number, number], opacity: number) {
    for (let index = 0; index < this.data.length; index += 3) {
      this.data[index] = blend(this.data[index], color[0], opacity);
      this.data[index + 1] = blend(this.data[index + 1], color[1], opacity);
      this.data[index + 2] = blend(this.data[index + 2], color[2], opacity);
    }
  }
}

function blend(source: number, target: number, opacity: number) {
  return Math.round(source * (1 - opacity) + target * opacity);
}

function encodePng(width: number, height: number, rgb: Buffer) {
  const scanlines = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const scanlineOffset = y * (width * 3 + 1);
    scanlines[scanlineOffset] = 0;
    rgb.copy(scanlines, scanlineOffset + 1, y * width * 3, (y + 1) * width * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr(width, height)),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(width: number, height: number) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 2;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.byteLength, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

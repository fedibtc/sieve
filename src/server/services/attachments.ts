import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachments } from "@/server/db/schema";

export const MAX_ATTACHMENT_BYTES = 2_000_000;
export const PATCH_MIME_TYPE = "text/x-patch";
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export async function createPngAttachment(input: {
  data: Buffer;
  createdByUserId: string;
}) {
  const parsed = parsePng(input.data);
  return upsertAttachment({
    ...input,
    mimeType: "image/png",
    width: parsed.width,
    height: parsed.height,
  });
}

export async function createPatchAttachment(input: {
  data: Buffer;
  createdByUserId: string;
}) {
  parsePatch(input.data);
  return upsertAttachment({
    ...input,
    mimeType: PATCH_MIME_TYPE,
    width: null,
    height: null,
  });
}

async function upsertAttachment(input: {
  data: Buffer;
  createdByUserId: string;
  mimeType: string;
  width: number | null;
  height: number | null;
}) {
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.sha256, sha256))
    .limit(1);
  if (existing) {
    return { attachment: existing, existing: true };
  }

  const [created] = await db
    .insert(attachments)
    .values({
      sha256,
      mimeType: input.mimeType,
      bytes: input.data.byteLength,
      width: input.width,
      height: input.height,
      data: input.data,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  return { attachment: created, existing: false };
}

export async function getAttachmentById(id: string) {
  const db = await getDb();
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  return attachment ?? null;
}

export async function getAttachmentByHash(sha256: string) {
  const db = await getDb();
  const [attachment] = await db
    .select({
      id: attachments.id,
      sha256: attachments.sha256,
      bytes: attachments.bytes,
      width: attachments.width,
      height: attachments.height,
      mimeType: attachments.mimeType,
    })
    .from(attachments)
    .where(eq(attachments.sha256, sha256))
    .limit(1);
  return attachment ?? null;
}

export async function findMissingAttachmentIds(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const db = await getDb();
  const rows = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(inArray(attachments.id, uniqueIds));
  const found = new Set(rows.map((row) => row.id));
  return uniqueIds.filter((id) => !found.has(id));
}

export function parsePng(data: Buffer) {
  if (data.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment exceeds the 2 MB limit");
  }
  if (
    data.byteLength < 33 ||
    !data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new Error("Only PNG attachments are supported");
  }
  if (data.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Invalid PNG: missing IHDR");
  }

  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (!width || !height) {
    throw new Error("Invalid PNG dimensions");
  }
  return { width, height };
}

export function parsePatch(data: Buffer) {
  if (data.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new Error("Attachment exceeds the 2 MB limit");
  }
  if (data.byteLength === 0) {
    throw new Error("Patch attachments cannot be empty");
  }
  const text = new TextDecoder("utf-8", { fatal: true });
  try {
    text.decode(data);
  } catch {
    throw new Error("Patch attachments must be valid UTF-8 text");
  }
}

export function attachmentResponse(attachment: {
  id: string;
  sha256: string;
  bytes: number;
  width: number | null;
  height: number | null;
  mimeType: string;
}) {
  return {
    id: attachment.id,
    sha256: attachment.sha256,
    bytes: attachment.bytes,
    width: attachment.width,
    height: attachment.height,
    mimeType: attachment.mimeType,
  };
}

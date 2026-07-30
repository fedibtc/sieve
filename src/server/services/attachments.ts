import { createHash } from "node:crypto";
import { basename } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachments } from "@/server/db/schema";
import {
  type AttachmentStorageProvider,
  getAttachmentStorageProvider,
  isVercelBlobConfigured,
  putAttachmentInBlob,
  verifyStoredAttachment,
  writeLocalAttachment,
} from "./attachment-storage";

export const MAX_ATTACHMENT_BYTES = 2_000_000;
export const MAX_DIRECT_ATTACHMENT_BYTES = 250_000_000;
export const SUPPORTED_ATTACHMENT_TYPES = [
  "image/png",
  "video/webm",
  "video/mp4",
] as const;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type SupportedAttachmentType = (typeof SUPPORTED_ATTACHMENT_TYPES)[number];

export async function createPngAttachment(input: {
  data: Buffer;
  createdByUserId: string;
  originalFilename?: string;
}) {
  const parsed = parsePng(input.data);
  const sha256 = createHash("sha256").update(input.data).digest("hex");
  const existing = await getReadyAttachmentByHash(sha256);
  if (existing) {
    return { attachment: existing, existing: true };
  }

  const db = await getDb();
  const originalFilename = input.originalFilename ?? "screenshot.png";
  if (isVercelBlobConfigured()) {
    const storageKey = attachmentStoragePathname(sha256, "image/png");
    await putAttachmentInBlob({
      pathname: storageKey,
      data: input.data,
      mimeType: "image/png",
    });
    const [created] = await db
      .insert(attachments)
      .values({
        sha256,
        mimeType: "image/png",
        bytes: input.data.byteLength,
        width: parsed.width,
        height: parsed.height,
        originalFilename,
        storageProvider: "vercel-blob",
        storageKey,
        status: "ready",
        data: null,
        createdByUserId: input.createdByUserId,
      })
      .onConflictDoNothing({ target: attachments.sha256 })
      .returning();
    return {
      attachment: created ?? (await requireReadyAttachmentByHash(sha256)),
      existing: !created,
    };
  }

  const [created] = await db
    .insert(attachments)
    .values({
      sha256,
      mimeType: "image/png",
      bytes: input.data.byteLength,
      width: parsed.width,
      height: parsed.height,
      originalFilename,
      status: "ready",
      data: input.data,
      createdByUserId: input.createdByUserId,
    })
    .onConflictDoNothing({ target: attachments.sha256 })
    .returning();

  return {
    attachment: created ?? (await requireReadyAttachmentByHash(sha256)),
    existing: !created,
  };
}

export async function reserveAttachment(input: {
  sha256: string;
  mimeType: string;
  bytes: number;
  originalFilename: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  createdByUserId: string;
}) {
  validateAttachmentReservation(input);
  const existing = await getReadyAttachmentByHash(input.sha256);
  if (existing) {
    return { attachment: existing, existing: true };
  }

  const provider = getAttachmentStorageProvider();
  const storageKey = attachmentStoragePathname(
    input.sha256,
    input.mimeType as SupportedAttachmentType,
  );
  const db = await getDb();
  const [created] = await db
    .insert(attachments)
    .values({
      sha256: input.sha256,
      mimeType: input.mimeType,
      bytes: input.bytes,
      width: input.width,
      height: input.height,
      durationMs: input.durationMs,
      originalFilename: basename(input.originalFilename),
      storageProvider: provider,
      storageKey,
      status: "pending",
      data: null,
      createdByUserId: input.createdByUserId,
    })
    .onConflictDoNothing({ target: attachments.sha256 })
    .returning();

  if (created) {
    return { attachment: created, existing: false };
  }

  const conflicted = await getAttachmentByHashRecord(input.sha256);
  if (!conflicted) {
    throw new Error("The attachment reservation failed");
  }
  if (
    conflicted.mimeType !== input.mimeType ||
    conflicted.bytes !== input.bytes
  ) {
    throw new Error("The attachment hash has conflicting metadata");
  }
  return {
    attachment: conflicted,
    existing: conflicted.status === "ready",
  };
}

export async function storeLocalAttachmentUpload(input: {
  id: string;
  data: Buffer;
  mimeType: string;
}) {
  const attachment = await getAttachmentById(input.id);
  if (attachment?.status !== "pending") {
    throw new Error("The attachment upload is not pending");
  }
  if (attachment.storageProvider !== "local" || !attachment.storageKey) {
    throw new Error("The attachment does not use local storage");
  }
  if (input.mimeType !== attachment.mimeType) {
    throw new Error(`Expected ${attachment.mimeType}`);
  }
  if (input.data.byteLength !== attachment.bytes) {
    throw new Error(`Expected ${attachment.bytes} bytes`);
  }
  if (attachment.mimeType === "image/png") {
    const dimensions = parsePng(input.data, MAX_DIRECT_ATTACHMENT_BYTES);
    if (
      (attachment.width && attachment.width !== dimensions.width) ||
      (attachment.height && attachment.height !== dimensions.height)
    ) {
      throw new Error("The PNG dimensions do not match the reservation");
    }
  }
  await writeLocalAttachment(attachment.storageKey, input.data);
}

export async function completeAttachmentUpload(input: { id: string }) {
  const attachment = await getAttachmentById(input.id);
  if (!attachment) {
    throw new Error("Attachment not found");
  }
  if (attachment.status === "ready") {
    return attachment;
  }
  if (
    attachment.status !== "pending" ||
    !attachment.storageKey ||
    !isStorageProvider(attachment.storageProvider)
  ) {
    throw new Error("The attachment upload is not pending");
  }

  await verifyStoredAttachment({
    provider: attachment.storageProvider,
    pathname: attachment.storageKey,
    mimeType: attachment.mimeType,
    bytes: attachment.bytes,
  });
  const db = await getDb();
  const [ready] = await db
    .update(attachments)
    .set({ status: "ready" })
    .where(
      and(eq(attachments.id, attachment.id), eq(attachments.status, "pending")),
    )
    .returning();
  return ready ?? (await getAttachmentById(attachment.id));
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
  const attachment = await getReadyAttachmentByHash(sha256);
  if (!attachment) {
    return null;
  }
  return attachmentResponse(attachment);
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
    .where(
      and(inArray(attachments.id, uniqueIds), eq(attachments.status, "ready")),
    );
  const found = new Set(rows.map((row) => row.id));
  return uniqueIds.filter((id) => !found.has(id));
}

export function parsePng(data: Buffer, maximumBytes = MAX_ATTACHMENT_BYTES) {
  if (data.byteLength > maximumBytes) {
    throw new Error(
      `Attachment exceeds the ${formatByteLimit(maximumBytes)} limit`,
    );
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

export function attachmentResponse(attachment: {
  id: string;
  sha256: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs?: number | null;
  originalFilename?: string | null;
  mimeType: string;
  status?: string;
}) {
  return {
    id: attachment.id,
    sha256: attachment.sha256,
    bytes: attachment.bytes,
    width: attachment.width,
    height: attachment.height,
    durationMs: attachment.durationMs ?? null,
    originalFilename: attachment.originalFilename ?? null,
    mimeType: attachment.mimeType,
    status: attachment.status ?? "ready",
  };
}

function validateAttachmentReservation(input: {
  sha256: string;
  mimeType: string;
  bytes: number;
  originalFilename: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) {
    throw new Error("sha256 must contain 64 lowercase hexadecimal characters");
  }
  if (
    !SUPPORTED_ATTACHMENT_TYPES.includes(
      input.mimeType as SupportedAttachmentType,
    )
  ) {
    throw new Error("Only PNG, WebM, and MP4 attachments are supported");
  }
  if (
    !Number.isInteger(input.bytes) ||
    input.bytes < 1 ||
    input.bytes > MAX_DIRECT_ATTACHMENT_BYTES
  ) {
    throw new Error("Attachment exceeds the 250 MB limit");
  }
  if (!input.originalFilename.trim()) {
    throw new Error("originalFilename is required");
  }
  for (const [name, value] of [
    ["width", input.width],
    ["height", input.height],
    ["durationMs", input.durationMs],
  ] as const) {
    if (
      value !== undefined &&
      value !== null &&
      (!Number.isInteger(value) || value < 1)
    ) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
}

export function attachmentStoragePathname(
  sha256: string,
  mimeType: SupportedAttachmentType,
) {
  const extension = {
    "image/png": "png",
    "video/webm": "webm",
    "video/mp4": "mp4",
  }[mimeType];
  return `attachments/${sha256}.${extension}`;
}

async function getAttachmentByHashRecord(sha256: string) {
  const db = await getDb();
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.sha256, sha256))
    .limit(1);
  return attachment ?? null;
}

async function getReadyAttachmentByHash(sha256: string) {
  const db = await getDb();
  const [attachment] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.sha256, sha256), eq(attachments.status, "ready")))
    .limit(1);
  return attachment ?? null;
}

async function requireReadyAttachmentByHash(sha256: string) {
  const attachment = await getReadyAttachmentByHash(sha256);
  if (!attachment) {
    throw new Error("The attachment could not be created");
  }
  return attachment;
}

function isStorageProvider(
  value: string | null,
): value is AttachmentStorageProvider {
  return value === "local" || value === "vercel-blob";
}

function formatByteLimit(bytes: number) {
  return bytes === MAX_ATTACHMENT_BYTES ? "2 MB" : `${bytes} byte`;
}

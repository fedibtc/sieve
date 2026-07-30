import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { head, issueSignedToken, presignUrl, put } from "@vercel/blob";

export type AttachmentStorageProvider = "local" | "vercel-blob";

export const ATTACHMENT_UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
export const ATTACHMENT_DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000;

export function getAttachmentStorageProvider(): AttachmentStorageProvider {
  return isVercelBlobConfigured() ? "vercel-blob" : "local";
}

export async function createAttachmentUploadTarget(input: {
  provider: AttachmentStorageProvider;
  pathname: string;
  mimeType: string;
  bytes: number;
  localUploadUrl: string;
}) {
  if (input.provider === "local") {
    return {
      uploadUrl: input.localUploadUrl,
      uploadHeaders: { "content-type": input.mimeType },
      requiresAuth: true,
    };
  }

  const validUntil = Date.now() + ATTACHMENT_UPLOAD_URL_TTL_MS;
  const signedToken = await issueSignedToken({
    pathname: input.pathname,
    operations: ["put"],
    validUntil,
    allowedContentTypes: [input.mimeType],
    maximumSizeInBytes: input.bytes,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    access: "private",
    operation: "put",
    pathname: input.pathname,
    validUntil,
    allowedContentTypes: [input.mimeType],
    maximumSizeInBytes: input.bytes,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return {
    uploadUrl: presignedUrl,
    uploadHeaders: { "content-type": input.mimeType },
    requiresAuth: false,
  };
}

export async function getAttachmentDownloadUrl(input: {
  provider: AttachmentStorageProvider;
  pathname: string;
}) {
  if (input.provider !== "vercel-blob") {
    return null;
  }
  const validUntil = Date.now() + ATTACHMENT_DOWNLOAD_URL_TTL_MS;
  const signedToken = await issueSignedToken({
    pathname: input.pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    access: "private",
    operation: "get",
    pathname: input.pathname,
    validUntil,
  });
  return presignedUrl;
}

export async function verifyStoredAttachment(input: {
  provider: AttachmentStorageProvider;
  pathname: string;
  mimeType: string;
  bytes: number;
}) {
  if (input.provider === "local") {
    const metadata = await stat(localPath(input.pathname));
    if (metadata.size !== input.bytes) {
      throw new Error(
        `Stored attachment has ${metadata.size} bytes; expected ${input.bytes}`,
      );
    }
    return;
  }

  const metadata = await head(input.pathname);
  if (metadata.size !== input.bytes) {
    throw new Error(
      `Stored attachment has ${metadata.size} bytes; expected ${input.bytes}`,
    );
  }
  if (metadata.contentType !== input.mimeType) {
    throw new Error(
      `Stored attachment has type ${metadata.contentType}; expected ${input.mimeType}`,
    );
  }
}

export async function writeLocalAttachment(pathname: string, data: Buffer) {
  const path = localPath(pathname);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export async function readLocalAttachment(pathname: string) {
  return readFile(localPath(pathname));
}

export async function putAttachmentInBlob(input: {
  pathname: string;
  data: Buffer;
  mimeType: string;
}) {
  const uploaded = await put(input.pathname, input.data, {
    access: "private",
    contentType: input.mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return uploaded.pathname;
}

export function isVercelBlobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

function localPath(pathname: string) {
  const root = resolve(process.env.SIEVE_ATTACHMENT_DIR ?? "data/attachments");
  const path = resolve(root, pathname);
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    throw new Error("Invalid attachment storage pathname");
  }
  return path;
}

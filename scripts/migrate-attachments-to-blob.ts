import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { attachments } from "@/server/db/schema";
import {
  isVercelBlobConfigured,
  putAttachmentInBlob,
  verifyStoredAttachment,
} from "@/server/services/attachment-storage";
import { attachmentStoragePathname } from "@/server/services/attachments";

async function main() {
  if (!isVercelBlobConfigured()) {
    throw new Error(
      "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN or Vercel OIDC variables.",
    );
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(attachments)
    .where(and(isNull(attachments.storageKey), isNotNull(attachments.data)));
  let migrated = 0;
  for (const attachment of rows) {
    if (!attachment.data || attachment.mimeType !== "image/png") {
      continue;
    }
    const storageKey = attachmentStoragePathname(
      attachment.sha256,
      "image/png",
    );
    await putAttachmentInBlob({
      pathname: storageKey,
      data: Buffer.from(attachment.data),
      mimeType: attachment.mimeType,
    });
    await verifyStoredAttachment({
      provider: "vercel-blob",
      pathname: storageKey,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
    });
    await db
      .update(attachments)
      .set({
        storageProvider: "vercel-blob",
        storageKey,
        originalFilename:
          attachment.originalFilename ?? `${attachment.sha256}.png`,
      })
      .where(eq(attachments.id, attachment.id));
    migrated += 1;
    console.log(`Migrated attachment ${attachment.id}`);
  }

  console.log(`Migrated ${migrated} attachment(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
import {
  getAttachmentDownloadUrl,
  readLocalAttachment,
} from "@/server/services/attachment-storage";
import { getAttachmentById } from "@/server/services/attachments";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await getAttachmentById(id);
  if (attachment?.status !== "ready") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (attachment.storageProvider === "vercel-blob" && attachment.storageKey) {
    const url = await getAttachmentDownloadUrl({
      provider: "vercel-blob",
      pathname: attachment.storageKey,
    });
    if (!url) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const response = NextResponse.redirect(url, { status: 307 });
    response.headers.set("cache-control", "private, no-store");
    return response;
  }

  if (attachment.storageProvider === "local" && attachment.storageKey) {
    const data = await readLocalAttachment(attachment.storageKey).catch(
      () => null,
    );
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return attachmentDataResponse(data, attachment);
  }

  if (!attachment.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return attachmentDataResponse(Buffer.from(attachment.data), attachment);
}

function attachmentDataResponse(
  data: Buffer,
  attachment: { mimeType: string; bytes: number },
) {
  const contentType = attachment.mimeType.startsWith("text/")
    ? `${attachment.mimeType}; charset=utf-8`
    : attachment.mimeType;
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": contentType,
      "content-length": String(attachment.bytes),
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

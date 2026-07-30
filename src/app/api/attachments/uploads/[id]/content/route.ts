import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
import {
  MAX_DIRECT_ATTACHMENT_BYTES,
  storeLocalAttachmentUpload,
} from "@/server/services/attachments";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_DIRECT_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: "Attachment exceeds the 250 MB limit" },
      { status: 413 },
    );
  }

  try {
    const data = Buffer.from(await request.arrayBuffer());
    if (data.byteLength > MAX_DIRECT_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Attachment exceeds the 250 MB limit" },
        { status: 413 },
      );
    }
    const { id } = await params;
    await storeLocalAttachmentUpload({
      id,
      data,
      mimeType:
        request.headers.get("content-type")?.split(";")[0] ??
        "application/octet-stream",
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}

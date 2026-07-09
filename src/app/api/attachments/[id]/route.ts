import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
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
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(Buffer.from(attachment.data), {
    headers: {
      "content-type": attachment.mimeType,
      "content-length": String(attachment.bytes),
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

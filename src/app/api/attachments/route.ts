import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
import {
  attachmentResponse,
  createPngAttachment,
  MAX_ATTACHMENT_BYTES,
} from "@/server/services/attachments";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0];
  if (contentType !== "image/png") {
    return NextResponse.json(
      { error: "Only image/png uploads are supported" },
      { status: 415 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: "Attachment exceeds the 2 MB limit" },
      { status: 413 },
    );
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: "Attachment exceeds the 2 MB limit" },
      { status: 413 },
    );
  }

  try {
    const { attachment, existing } = await createPngAttachment({
      data,
      createdByUserId: auth.user.id,
      originalFilename:
        request.headers.get("x-sieve-filename") ?? "screenshot.png",
    });
    return NextResponse.json(
      { ...attachmentResponse(attachment), existing },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid attachment" },
      { status: 400 },
    );
  }
}

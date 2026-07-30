import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
import {
  attachmentResponse,
  completeAttachmentUpload,
} from "@/server/services/attachments";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const attachment = await completeAttachmentUpload({ id });
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(attachmentResponse(attachment));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}

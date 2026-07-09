import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
import {
  attachmentResponse,
  getAttachmentByHash,
} from "@/server/services/attachments";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sha256: string }> },
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sha256 } = await params;
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    return NextResponse.json({ error: "Invalid sha256" }, { status: 400 });
  }

  const attachment = await getAttachmentByHash(sha256.toLowerCase());
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(attachmentResponse(attachment));
}

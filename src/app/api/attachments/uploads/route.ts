import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/server/auth-middleware";
import { createAttachmentUploadTarget } from "@/server/services/attachment-storage";
import {
  attachmentResponse,
  reserveAttachment,
} from "@/server/services/attachments";

export const dynamic = "force-dynamic";

const reservationSchema = z.object({
  sha256: z.string(),
  mimeType: z.string(),
  bytes: z.number(),
  originalFilename: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = reservationSchema.parse(await request.json());
    const { attachment, existing } = await reserveAttachment({
      ...input,
      createdByUserId: auth.user.id,
    });
    if (existing) {
      return NextResponse.json({
        ...attachmentResponse(attachment),
        existing: true,
        upload: null,
      });
    }
    if (
      !attachment.storageProvider ||
      !attachment.storageKey ||
      (attachment.storageProvider !== "local" &&
        attachment.storageProvider !== "vercel-blob")
    ) {
      throw new Error("The attachment storage reservation is invalid");
    }

    const origin = new URL(request.url).origin;
    const upload = await createAttachmentUploadTarget({
      provider: attachment.storageProvider,
      pathname: attachment.storageKey,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
      localUploadUrl: `${origin}/api/attachments/uploads/${attachment.id}/content`,
    });
    return NextResponse.json(
      {
        ...attachmentResponse(attachment),
        existing: false,
        upload,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid attachment upload",
      },
      { status: 400 },
    );
  }
}

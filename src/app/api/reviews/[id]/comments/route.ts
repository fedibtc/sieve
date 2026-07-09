import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth-middleware";
import { createComment, listCommentThreads } from "@/server/services/comments";
import { ensureUser } from "@/server/services/users";
import { anchorSchema } from "@/shared/anchors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  await ensureUser(session.user);
  const { id } = await params;
  return NextResponse.json({ threads: await listCommentThreads(id) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const user = await ensureUser(session.user);
  const body = (await request.json()) as {
    message?: string;
    anchor?: unknown;
    resolutionTarget?: "agent" | "human";
    parentCommentId?: string | null;
  };
  if (!body.message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const anchor =
    body.anchor === null || body.anchor === undefined
      ? null
      : anchorSchema.parse(body.anchor);
  const { id } = await params;
  const comment = await createComment({
    reviewId: id,
    authorUserId: user.id,
    createdBy: "human",
    message: body.message,
    anchor,
    resolutionTarget: body.resolutionTarget ?? "agent",
    parentCommentId: body.parentCommentId ?? null,
  });

  return NextResponse.json({ comment }, { status: 201 });
}

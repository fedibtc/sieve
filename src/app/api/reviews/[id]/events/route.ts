import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth-middleware";
import { listReviewEvents } from "@/server/services/events";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  await ensureUser(session.user);
  const { id } = await params;
  return NextResponse.json({ events: await listReviewEvents(id) });
}

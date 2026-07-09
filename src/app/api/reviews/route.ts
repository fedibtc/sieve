import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth-middleware";
import { listReviews } from "@/server/services/reviews";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  await ensureUser(session.user);
  return NextResponse.json({ reviews: await listReviews() });
}

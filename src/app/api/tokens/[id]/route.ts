import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth-middleware";
import { getDb } from "@/server/db/client";
import { apikey } from "@/server/db/schema";
import { ensureUser } from "@/server/services/users";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const user = await ensureUser(session.user);
  const { id } = await params;
  const db = await getDb();
  const deleted = await db
    .delete(apikey)
    .where(and(eq(apikey.id, id), eq(apikey.referenceId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

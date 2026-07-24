import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/server/auth-middleware";
import { getDb } from "@/server/db/client";
import { apikey } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authenticated = await authenticateRequest(request);
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const deleted = await db
    .delete(apikey)
    .where(
      and(eq(apikey.id, id), eq(apikey.referenceId, authenticated.user.id)),
    )
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

import { getDb } from "@/server/db/client";
import { user } from "@/server/db/schema";

export type SessionUser = {
  id: string;
  name?: string | null;
  email: string;
  emailVerified?: boolean | null;
  image?: string | null;
};

export async function ensureUser(sessionUser: SessionUser) {
  const db = await getDb();
  const values = {
    id: sessionUser.id,
    name: sessionUser.name || sessionUser.email,
    email: sessionUser.email,
    emailVerified: Boolean(sessionUser.emailVerified),
    image: sessionUser.image ?? null,
    updatedAt: new Date(),
  };

  const [upserted] = await db
    .insert(user)
    .values({ ...values, createdAt: new Date() })
    .onConflictDoUpdate({
      target: user.id,
      set: values,
    })
    .returning();
  return upserted;
}

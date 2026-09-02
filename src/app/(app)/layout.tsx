import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/server/auth-middleware";
import { ensureUser } from "@/server/services/users";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  await ensureUser(session.user);

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <AppHeader userLabel={session.user.name ?? session.user.email} />
      {children}
    </div>
  );
}

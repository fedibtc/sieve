import Link from "next/link";
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 h-12 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-6 px-6">
          <nav className="flex items-center gap-5 text-sm">
            <Link className="font-semibold tracking-tight" href="/reviews">
              sieve
            </Link>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/reviews"
            >
              Reviews
            </Link>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/settings/tokens"
            >
              Tokens
            </Link>
          </nav>
          <div className="min-w-0 truncate text-right text-sm text-muted-foreground">
            {session.user.name ?? session.user.email}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

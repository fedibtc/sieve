import Link from "next/link";
import { ColorModeSelect } from "@/components/color-mode";
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
      <header className="sticky top-0 z-40 h-12 border-b bg-page-header">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-6 px-8">
          <nav className="flex items-center gap-5 text-sm">
            <Link
              className="rounded-md font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/reviews"
            >
              sieve
            </Link>
            <Link
              className="rounded-md px-2 py-1 text-fg-muted transition-colors hover:bg-control-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/reviews"
            >
              Reviews
            </Link>
            <Link
              className="rounded-md px-2 py-1 text-fg-muted transition-colors hover:bg-control-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/settings/tokens"
            >
              Tokens
            </Link>
          </nav>
          <div className="flex min-w-0 items-center gap-3">
            <ColorModeSelect />
            <span className="hidden min-w-0 truncate text-sm text-fg-muted sm:inline">
              {session.user.name ?? session.user.email}
            </span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

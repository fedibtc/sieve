"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ColorModeSelect } from "@/components/color-mode";

const items = [
  { href: "/reviews", label: "Reviews" },
  { href: "/settings/tokens", label: "Tokens" },
];

export function AppHeader({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 h-12 border-b bg-page-header">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-stretch justify-between gap-6 px-6">
        <nav className="flex items-stretch gap-2 text-sm">
          <Link
            className="mr-2 flex items-center font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/reviews"
          >
            sieve
          </Link>
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className="group relative flex items-center"
                href={item.href}
              >
                <span
                  className={`rounded-md px-2 py-1 transition-colors group-hover:bg-control-hover group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                    active ? "font-semibold text-fg" : "text-fg"
                  }`}
                >
                  {item.label}
                </span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-sm bg-nav-active"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex min-w-0 items-center gap-3">
          <ColorModeSelect />
          <span className="hidden min-w-0 truncate text-sm text-fg-muted sm:inline">
            {userLabel}
          </span>
        </div>
      </div>
    </header>
  );
}

"use client";

export function LoginButton() {
  async function signIn() {
    const callbackURL = "/reviews";
    window.location.href = `/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
  }

  return (
    <button
      type="button"
      onClick={signIn}
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.26h5.38a4.6 4.6 0 0 1-1.99 3.02v2.77h3.22c1.88-1.73 2.99-4.28 2.99-7.82z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.7 0 4.96-.9 6.61-2.45l-3.22-2.77c-.9.6-2.04.95-3.39.95-2.61 0-4.82-1.76-5.61-4.13H3.06v2.86A9.99 9.99 0 0 0 12 22z"
          fill="#34A853"
        />
        <path
          d="M6.39 13.6A6.01 6.01 0 0 1 6.08 12c0-.56.11-1.1.31-1.6V7.54H3.06A9.98 9.98 0 0 0 2 12c0 1.61.39 3.13 1.06 4.46l3.33-2.86z"
          fill="#FBBC05"
        />
        <path
          d="M12 6.27c1.47 0 2.78.5 3.82 1.49l2.86-2.86C16.95 3.29 14.7 2.32 12 2.32a9.99 9.99 0 0 0-8.94 5.22l3.33 2.86C7.18 8.03 9.39 6.27 12 6.27z"
          fill="#EA4335"
        />
      </svg>
      Continue with Google
    </button>
  );
}

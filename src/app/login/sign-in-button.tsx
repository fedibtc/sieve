"use client";

function signInWith(provider: "google" | "github") {
  const callbackURL = "/reviews";
  window.location.href = `/api/auth/sign-in/social?provider=${provider}&callbackURL=${encodeURIComponent(callbackURL)}`;
}

const buttonClassName =
  "inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function GoogleLoginButton() {
  return (
    <button
      type="button"
      onClick={() => signInWith("google")}
      className={buttonClassName}
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

export function GithubLoginButton() {
  return (
    <button
      type="button"
      onClick={() => signInWith("github")}
      className={buttonClassName}
    >
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
      Continue with GitHub
    </button>
  );
}

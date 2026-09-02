import { getAuthCallbackURL } from "@/server/auth-redirect";
import { GithubLoginButton } from "./sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const callbackURL = getAuthCallbackURL(params.next);
  const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID);
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <section className="w-full max-w-sm rounded-md border bg-canvas p-6">
        <div>
          <p className="text-sm font-medium text-fg-muted">sieve</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Sign in to sieve
          </h1>
          <p className="mt-3 text-sm leading-6 text-fg-muted">
            Access is restricted to allowlisted GitHub users.
          </p>
        </div>
        {params.error ? (
          <div className="mt-5 rounded-md border border-danger-border bg-danger-muted px-3 py-2 text-sm text-danger-fg">
            Sign-in failed. Use an allowed account.
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          {githubEnabled ? (
            <GithubLoginButton callbackURL={callbackURL} />
          ) : null}
          {!githubEnabled ? (
            <p className="text-sm text-fg-muted">
              No sign-in provider is configured. Set GITHUB_CLIENT_ID.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

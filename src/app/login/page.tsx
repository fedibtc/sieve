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
    <main className="flex min-h-screen flex-col items-center bg-canvas px-6 pt-16 text-fg">
      <div className="w-full max-w-[340px]">
        <p className="text-center text-sm font-semibold">sieve</p>
        <h1 className="mt-4 text-center text-2xl font-light">
          Sign in to sieve
        </h1>
        {params.error ? (
          <div className="mt-4 rounded-md border border-danger-border bg-danger-muted px-4 py-3 text-sm">
            Sign-in failed. Use an allowed account.
          </div>
        ) : null}
        <section className="mt-4 rounded-md border bg-canvas-subtle p-4">
          <p className="text-sm text-fg-muted">
            Access is restricted to allowlisted GitHub users.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {githubEnabled ? (
              <GithubLoginButton callbackURL={callbackURL} />
            ) : (
              <p className="text-sm text-fg-muted">
                No sign-in provider is configured. Set GITHUB_CLIENT_ID.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

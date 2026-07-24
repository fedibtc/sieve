import { GithubLoginButton } from "./sign-in-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">sieve</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Sign in to sieve
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Access is restricted to allowlisted GitHub users.
          </p>
        </div>
        {params.error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Sign-in failed. Use an allowed account.
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          {githubEnabled ? <GithubLoginButton /> : null}
          {!githubEnabled ? (
            <p className="text-sm text-muted-foreground">
              No sign-in provider is configured. Set GITHUB_CLIENT_ID.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

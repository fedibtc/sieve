import { requireSession } from "@/server/auth-middleware";
import { getDeviceAuthorization } from "@/server/device-authorization";
import { selectDeviceCode, submitDeviceDecision } from "./actions";

export default async function DeviceAuthorizationPage({
  searchParams,
}: {
  searchParams: Promise<{
    user_code?: string;
    decision?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const returnTo = params.user_code
    ? `/device?${new URLSearchParams({ user_code: params.user_code })}`
    : "/device";
  await requireSession(returnTo);
  const record = params.user_code
    ? await getDeviceAuthorization(params.user_code)
    : null;
  const pending =
    record?.status === "pending" && record.expiresAt.getTime() > Date.now();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <section className="w-full max-w-lg rounded-md border bg-canvas p-6">
        <p className="text-sm font-medium text-fg-muted">sieve</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Authorize sieve CLI
        </h1>
        <p className="mt-3 text-sm leading-6 text-fg-muted">
          Enter the code shown by <code>sieve login</code>, then approve only if
          you started the request.
        </p>

        <form action={selectDeviceCode} className="mt-6 flex gap-3">
          <label className="flex-1 text-sm font-medium">
            User code
            <input
              name="userCode"
              defaultValue={params.user_code ?? ""}
              autoComplete="one-time-code"
              required
              className="mt-2 h-11 w-full rounded-md border bg-canvas px-3 font-mono uppercase"
            />
          </label>
          <button
            type="submit"
            className="mt-7 h-11 cursor-pointer rounded-md border border-btn-border bg-btn px-4 text-sm font-medium text-btn-fg shadow-btn transition-colors hover:bg-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Continue
          </button>
        </form>

        {params.error ? (
          <p className="mt-5 rounded-md border border-danger-border bg-danger-muted px-3 py-2 text-sm text-danger-fg">
            {params.error}
          </p>
        ) : null}
        {params.decision ? (
          <p className="mt-5 rounded-md border border-success-border bg-success-muted px-3 py-2 text-sm text-fg">
            Device request {params.decision}. You can return to the CLI.
          </p>
        ) : null}
        {params.user_code && !record && !params.error ? (
          <p className="mt-5 text-sm text-danger-fg">
            The device code is invalid.
          </p>
        ) : null}
        {record ? (
          <div className="mt-6 rounded-md border p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-fg-muted">Client</dt>
              <dd>
                {record.clientId === "sieve-cli"
                  ? "Sieve CLI"
                  : record.clientId}
              </dd>
              <dt className="text-fg-muted">Client ID</dt>
              <dd className="font-mono">{record.clientId}</dd>
              <dt className="text-fg-muted">Requested access</dt>
              <dd>{record.scope || "Default access"}</dd>
              <dt className="text-fg-muted">Code</dt>
              <dd className="font-mono">{params.user_code}</dd>
            </dl>

            {pending ? (
              <form action={submitDeviceDecision} className="mt-5 flex gap-3">
                <input type="hidden" name="userCode" value={params.user_code} />
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="h-11 flex-1 cursor-pointer rounded-md border border-btn-primary-border bg-btn-primary px-4 text-sm font-medium text-fg-on-emphasis transition-colors hover:bg-btn-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Approve
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="denied"
                  className="h-11 flex-1 cursor-pointer rounded-md border border-btn-border bg-btn px-4 text-sm font-medium text-btn-fg shadow-btn transition-colors hover:bg-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Deny
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

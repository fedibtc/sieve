// GitHub sign-in is gated by login allowlist, but the user-creation hook only
// sees the user record (no provider, no login). The provider callback approves
// the email here and the hook consumes that approval within the same request.
const APPROVAL_TTL_MS = 60_000;

const approvals = new Map<
  string,
  {
    expiresAt: number;
    login: string;
  }
>();

export function approveGithubEmail(
  email: string | null | undefined,
  login: string | null | undefined,
) {
  if (!email || !login) {
    return;
  }
  approvals.set(email.toLowerCase(), {
    expiresAt: Date.now() + APPROVAL_TTL_MS,
    login: login.toLowerCase(),
  });
}

export function takeGithubApproval(email: string | null | undefined) {
  if (!email) {
    return null;
  }
  const key = email.toLowerCase();
  const approval = approvals.get(key);
  approvals.delete(key);
  return approval && approval.expiresAt > Date.now() ? approval.login : null;
}

export function resetGithubApprovalsForTests() {
  approvals.clear();
}

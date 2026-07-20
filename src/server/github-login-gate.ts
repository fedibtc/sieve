// GitHub sign-in is gated by login allowlist, but the user-creation hook only
// sees the user record (no provider, no login). The provider callback approves
// the email here and the hook consumes that approval within the same request.
const APPROVAL_TTL_MS = 60_000;

const approvals = new Map<string, number>();

export function approveGithubEmail(email: string | null | undefined) {
  if (!email) {
    return;
  }
  approvals.set(email.toLowerCase(), Date.now() + APPROVAL_TTL_MS);
}

export function takeGithubApproval(email: string | null | undefined) {
  if (!email) {
    return false;
  }
  const key = email.toLowerCase();
  const expiresAt = approvals.get(key);
  approvals.delete(key);
  return Boolean(expiresAt && expiresAt > Date.now());
}

export function resetGithubApprovalsForTests() {
  approvals.clear();
}

export function getAllowedDomains(env: NodeJS.ProcessEnv = process.env) {
  return (env.AUTH_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmailDomain(
  email: string | null | undefined,
  domains = getAllowedDomains(),
) {
  const domain = email?.split("@")[1]?.toLowerCase();
  return Boolean(domain && domains.includes(domain));
}

export function requireAllowedEmailDomain(email: string | null | undefined) {
  if (!isAllowedEmailDomain(email)) {
    throw new Error("Email domain is not allowed");
  }
}

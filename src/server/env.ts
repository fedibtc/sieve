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

export function getAllowedGithubUsers(env: NodeJS.ProcessEnv = process.env) {
  return (env.AUTH_ALLOWED_GITHUB_USERS ?? "")
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedGithubUser(
  login: string | null | undefined,
  users = getAllowedGithubUsers(),
) {
  return Boolean(login && users.includes(login.toLowerCase()));
}

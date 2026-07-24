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

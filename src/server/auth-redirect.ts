const DEFAULT_AUTH_CALLBACK_URL = "/reviews";
const CALLBACK_BASE_URL = "https://sieve.invalid";

export function getAuthCallbackURL(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_CALLBACK_URL;
  }

  try {
    const url = new URL(value, CALLBACK_BASE_URL);
    if (url.origin !== CALLBACK_BASE_URL) {
      return DEFAULT_AUTH_CALLBACK_URL;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_CALLBACK_URL;
  }
}

export function getLoginURL(returnTo?: string) {
  if (!returnTo) {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(getAuthCallbackURL(returnTo))}`;
}

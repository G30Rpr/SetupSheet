export function sanitizeInternalRedirectPath(value: string | null | undefined): string | null {
  if (value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
    return value;
  }
  return null;
}

/** Builds a same-origin OAuth callback URL and carries only a safe local destination. */
export function buildAuthCallbackUrl(origin: string, nextPath?: string): string {
  const callbackUrl = new URL("/auth/callback", origin);
  const safeNextPath = sanitizeInternalRedirectPath(nextPath);
  if (safeNextPath) callbackUrl.searchParams.set("next", safeNextPath);
  return callbackUrl.toString();
}

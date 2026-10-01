/**
 * Compare a browser Origin to the public request origin, accounting for a
 * trusted reverse proxy that forwards the original host and scheme while
 * Next's internal request URL uses a local host. Forwarded headers must be
 * set/overwritten by the hosting proxy; browsers cannot set them from page JS.
 */
export function isSameOriginRequest(request: Request, origin: string): boolean {
  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const protocol = forwardedProto ? `${forwardedProto.replace(/:$/, "")}:` : requestUrl.protocol;
    const expected = host ? new URL(`${protocol}//${host}`) : requestUrl;
    return new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}

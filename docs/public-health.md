# Public availability probe

The scheduled `public-health.yml` workflow includes `/api/health`. The route
performs one cookie-free anonymous `setups(id)` query limited to one row, using
the existing five-second Supabase request timeout. An empty valid response is
healthy; backend errors or transport failures return HTTP 503. JSON responses
contain only `status`, never row IDs, credentials, URLs or database errors.

Responses use `Cache-Control: no-store` and the route is dynamic. A warm instance
coalesces simultaneous probes and reuses success for 15 seconds or failure for
one second, limiting repeated reads while allowing monitoring retries to detect
recovery. This is per-instance caching, not a distributed rate limiter. The
existing proxy bypasses Auth refresh for this endpoint, including callers with
unrelated session cookies.

HTTP 200 establishes only that this deployment can perform the specified public
read. It does not validate reporting views, authenticated writes, RLS isolation,
Storage/Edge flows or migration readiness. Those remain separate release gates.
A merged route does not repair the currently deployed 404 until the matching
application revision is actually promoted.

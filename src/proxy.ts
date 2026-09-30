import { NextResponse, type NextRequest } from "next/server";

import { setupOgImageSegment } from "@/lib/setup-og-image-path";
import { unresolvableIdSegment } from "@/lib/id-route-guard";
import { isUuid } from "@/lib/utils";
import { updateSession } from "@/lib/supabase/proxy";

// Least-privilege CSP for what this app actually does: same-origin pages
// and Server Actions, next/font self-hosted fonts, avatars/setup files
// served from Discord's CDN and Supabase Storage (both https), and the
// Supabase client's own REST/auth calls (plus its realtime websocket,
// which the SDK can open even though this app doesn't subscribe to any
// channel). No third-party scripts at all.
//
// script-src uses a fresh per-request nonce instead of 'unsafe-inline' --
// this app has zero hand-authored inline <script> tags (the one exception,
// the JSON-LD block in layout.tsx, is nonced explicitly); Next's own
// framework-injected hydration scripts pick up the nonce automatically once
// it's present on the CSP response header.
//
// style-src keeps 'unsafe-inline': Radix UI (Select, Dropdown, Dialog,
// Sheet) sets inline `style="..."` attributes for positioning, and CSP
// nonces only ever cover <style>/<script> *elements* -- there's no nonce
// mechanism for the style="" *attribute*, so removing this would break
// every Radix popover/dropdown/dialog's positioning.
//
// 'unsafe-eval' is added to script-src in development only -- webpack's
// dev-mode Fast Refresh wraps modules in eval(), which the production
// bundle never does, so this doesn't loosen anything for real visitors.
const isDev = process.env.NODE_ENV !== "production";

// Keep malformed-ID requests as a real, useful 404 without invoking the
// streamed App Router layout. This response is intentionally static: never
// interpolate the rejected path segment into HTML.
const INVALID_ID_NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Page not found — SetupSheet</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #17191d; color: #f4f4f5; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; }
    main { box-sizing: border-box; width: min(100% - 2rem, 38rem); padding: 2rem; border: 1px solid #383b41; border-radius: 1rem; background: #202227; }
    h1 { margin-top: 0; font-size: clamp(1.6rem, 5vw, 2.25rem); }
    p { color: #c1c4ca; line-height: 1.6; }
    nav { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1.5rem; }
    a { color: #ff9884; text-underline-offset: .2em; }
    a:focus-visible { outline: 2px solid #ff9884; outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <p>SetupSheet · 404</p>
    <h1>We couldn’t find that page</h1>
    <p>The link may be incomplete or the page may no longer be available.</p>
    <nav aria-label="Helpful links"><a href="/setups">Browse setups</a><a href="/">Go to homepage</a></nav>
  </main>
</body>
</html>`;

function malformedIdResponse(pathname: string) {
  // Social-image endpoints must remain bodyless image 404s, not HTML documents.
  if (/\/opengraph-image\/?$/.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(INVALID_ID_NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https:",
    "font-src 'self'",
    "frame-src 'self' https://www.youtube-nocookie.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Without a reporting directive, a policy that is too tight (broken
    // feature) or too loose (missed an origin) is invisible in production.
    // Reports go to the same-origin route handler, which logs them.
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase appends ?code=... to whichever URL it redirects the browser to
  // after OAuth. If that URL isn't on the project's Redirect URLs allow-list,
  // Supabase silently falls back to the Site URL instead of erroring — so the
  // code can land on any page (commonly "/") rather than /auth/callback,
  // which is the only route that knows how to exchange it for a session.
  // Forward it there so login still completes even if that config drifts.
  if (searchParams.has("code") && pathname !== "/auth/callback") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // `/setups/<id>/opengraph-image` renders a Satori PNG for any string it is
  // given, and next.config.ts lets the result be CDN-cached for 24 h per URL.
  // Real setup ids are UUIDs, so anything else is either a typo or someone
  // discovering that arbitrary paths buy them free image renders plus one
  // `unstable_cache` entry each. Refuse it as a plain 404 -- no page render, no
  // edge cache entry, no CPU. Image endpoints intentionally have no body in
  // their 404 response because HTML would be incorrect for an image request.
  const ogImageSegment = setupOgImageSegment(pathname);
  if (ogImageSegment !== null && !isUuid(ogImageSegment)) {
    return new NextResponse(null, { status: 404 });
  }

  // `/setups/<id>` and `/profile/<id>` only ever resolve for UUIDs. A path
  // segment that cannot be one (a truncated share link, a typo, a crawler
  // inventing URLs) previously fell through to the streamed page and came back
  // as HTTP 200 with a "not found" body -- a soft 404 that wastes crawl budget
  // and tells search engines a dead URL is live. The root layout is dynamic and
  // streams, so a `notFound()` inside the page cannot change a status that has
  // already been flushed; refusing the request here is the only place the real
  // status can still be set. Same shape-guard idea as the OG-image check above,
  // and it costs nothing: no render, no database round trip.
  const notFoundSegment = unresolvableIdSegment(pathname);
  if (notFoundSegment !== null) {
    return malformedIdResponse(pathname);
  }

  // RUM requests are public and do not need a refreshed Supabase session.
  // Avoid spending an auth round trip on every beacon, especially when a
  // signed-in visitor leaves a page. The API route is bounded and stateless.
  if (pathname === "/api/telemetry") {
    return NextResponse.next();
  }

  const nonce = crypto.randomUUID();
  // Set before updateSession() so its internal NextResponse.next({ request })
  // carries this header through to the Server Component render, where
  // layout.tsx reads it back out via next/headers to nonce the JSON-LD tag.
  request.headers.set("x-nonce", nonce);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization
     * files, so the auth cookie stays fresh on every page/route hit.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

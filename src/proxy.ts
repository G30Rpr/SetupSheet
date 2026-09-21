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
  // edge cache entry, no CPU -- and let the already-200 page own the "not found"
  // copy the visitor actually sees.
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
    return new NextResponse(null, { status: 404 });
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

import { NextResponse, type NextRequest } from "next/server";

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

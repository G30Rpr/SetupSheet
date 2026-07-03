import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
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

  return updateSession(request);
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

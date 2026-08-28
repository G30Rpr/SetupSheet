import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export function sanitizeRedirectUrl(nextParam: string | null): string {
  if (!nextParam) return "/";
  // Ensure the redirect URL is a relative path starting with '/' and not protocol-relative ('//') or Windows-style ('/\')
  if (nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")) {
    return nextParam;
  }
  return "/";
}

// Handles the redirect back from Discord (via Supabase) after OAuth,
// exchanging the ?code= for a session and setting the auth cookies.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const targetPath = sanitizeRedirectUrl(searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // Do not reflect x-forwarded-host here. Unless a deployment proxy
        // explicitly strips/replaces that header, a caller can supply it and
        // turn a successful login into an open redirect to an arbitrary host.
        // Next's request URL is already the public origin selected by the
        // deployment, so use that origin and only allow the path above to vary.
        return NextResponse.redirect(`${origin}${targetPath}`);
      }
    } catch (error) {
      logger.error("auth callback: failed to exchange OAuth code", error);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

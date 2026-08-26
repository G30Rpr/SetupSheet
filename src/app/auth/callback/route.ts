import { NextResponse } from "next/server";

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
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";

      if (isLocal) {
        return NextResponse.redirect(`${origin}${targetPath}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetPath}`);
      } else {
        return NextResponse.redirect(`${origin}${targetPath}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

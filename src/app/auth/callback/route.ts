import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { sanitizeInternalRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export function sanitizeRedirectUrl(nextParam: string | null): string {
  return sanitizeInternalRedirectPath(nextParam) ?? "/";
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
      // Bind callbacks to the verifier for this OAuth attempt. Pass an
      // explicitly empty/invalid ID through too: the SDK must fail closed,
      // rather than falling back to another in-flight attempt's verifier.
      const flowId = searchParams.get("sb_flow_id");
      const { error } =
        flowId === null
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.exchangeCodeForSession(code, { flowId });

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

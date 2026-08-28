import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { fetchWithTimeout } from "@/lib/supabase/fetch";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the Supabase auth session on every request and keeps the
 * browser's cookies in sync. Without this, access tokens expire and
 * Server Components silently see a logged-out user.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key",
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: this refreshes the token and must run before any
  // other logic that reads the user's session. Wrapped in try/catch since
  // a network-level failure (DNS, connection refused) throws here rather
  // than resolving to a catchable { error } result -- without this, an
  // unreachable Supabase project would crash every single request.
  // Anonymous requests have nothing to refresh. Skipping this call removes a
  // needless Supabase round trip from every public page and makes metadata
  // routes (sitemap/robots/OG images) fast even before a project is configured.
  if (hasSupabaseAuthCookie(request.cookies.getAll().map(({ name }) => name))) {
    try {
      await supabase.auth.getUser();
    } catch (error) {
      logger.error("updateSession: failed to refresh auth session", error);
    }
  }

  return supabaseResponse;
}

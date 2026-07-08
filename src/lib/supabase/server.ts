import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Wrapped in React's cache() so the several calls a single
 * request typically makes (e.g. RootLayout's auth.getUser() plus each
 * data-layer function it fans out to) share one client instance instead
 * of each constructing their own -- cache() dedupes per request, so this
 * never leaks a client across requests the way a module-level singleton
 * would.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore because the
            // middleware below refreshes the session on every request.
          }
        },
      },
    }
  );
});

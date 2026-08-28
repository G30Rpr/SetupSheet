import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { fetchWithTimeout } from "@/lib/supabase/fetch";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cookie-free Supabase client for data that is public by RLS design. Keeping
 * it separate from the SSR client makes it safe to place those reads in
 * Next's cross-request Data Cache; personalized viewer state is still read
 * with the cookie-bound server client and is never cached here.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key",
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: fetchWithTimeout },
    }
  );
}

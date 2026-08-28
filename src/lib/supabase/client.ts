import { createBrowserClient } from "@supabase/ssr";

import { fetchWithTimeout } from "@/lib/supabase/fetch";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for use in Client Components. Safe to call repeatedly —
 * createBrowserClient reuses a single underlying instance.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key",
    { global: { fetch: fetchWithTimeout } }
  );
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "@/lib/supabase/fetch";
import type { Database } from "@/lib/supabase/database.types";

/** No session cookies: trusted reservation RPCs only. */
export function createStorageAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient<Database>(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchWithTimeout },
  });
}

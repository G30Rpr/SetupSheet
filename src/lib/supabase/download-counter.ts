import { createClient } from "@supabase/supabase-js";

import { fetchWithTimeout } from "@/lib/supabase/fetch";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Strictly server-side client for the one counters-only operation that public
 * downloads need. Never pass its key/client into a component or user response.
 *
 * A missing production secret must never block the public file download.
 * Staging environments should configure their own nonproduction credentials.
 */
export function createDownloadCounterClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: fetchWithTimeout },
  });
}

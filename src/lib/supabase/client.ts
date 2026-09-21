import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for use in Client Components. Safe to call repeatedly —
 * createBrowserClient reuses a single underlying instance.
 *
 * Deliberately does **not** reuse `fetchWithTimeout` (the 5 s cap the server
 * clients apply to metadata queries): this client is also what PUTs setup and
 * telemetry files to Storage, and a 5 s deadline would abort any legitimate
 * multi-megabyte upload on a normal connection. Server-side reads keep the
 * timeout; the browser gets the platform's own network timeout behaviour.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key"
  );
}

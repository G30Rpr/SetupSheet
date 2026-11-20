import { createClient } from "@supabase/supabase-js";
import { createUploadHandler } from "./handler.ts";

const inFlight = { active: 0 };

Deno.serve(async (request: Request) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const key = secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const origins = (Deno.env.get("STORAGE_UPLOAD_ORIGINS") || "")
      .split(",")
      .map((v) => v.trim())
      .filter((v) => {
        try {
          const u = new URL(v);
          return (
            u.origin === v &&
            (u.protocol === "https:" ||
              (u.protocol === "http:" &&
                ["localhost", "127.0.0.1"].includes(u.hostname)))
          );
        } catch {
          return false;
        }
      });
    if (!url || typeof key !== "string" || !key || !origins.length) {
      return new Response("Uploads unavailable", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const admin = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
              : AbortSignal.timeout(30_000),
          }),
      },
    });
    return await createUploadHandler({ admin, origins, inFlight })(request);
  } catch {
    return new Response("Uploads unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
});

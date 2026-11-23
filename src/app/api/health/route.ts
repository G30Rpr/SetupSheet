import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

// Cookie-free, bounded public read only. Coalesce probes per warm instance;
// this is neither a globally shared quota nor proof of signed-in user flows.
let cached: { ready: boolean; until: number } | undefined;
let pending: Promise<boolean> | undefined;

async function probe() {
  try {
    const { data, error } = await createPublicClient()
      .from("setups")
      .select("id")
      .limit(1);
    return !error && Array.isArray(data);
  } catch {
    return false;
  }
}

export async function GET() {
  let ready: boolean;
  if (cached && cached.until > Date.now()) ready = cached.ready;
  else {
    pending ??= probe().then((value) => {
      cached = { ready: value, until: Date.now() + (value ? 15_000 : 1_000) };
      pending = undefined;
      return value;
    });
    ready = await pending;
  }
  return Response.json(
    { status: ready ? "ok" : "unavailable" },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

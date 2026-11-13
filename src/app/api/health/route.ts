import { NextResponse } from "next/server";

import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Public, no-credential health probe: verify a bounded, RLS-governed Supabase
 * read rather than treating a successful Next.js page render as DB health.
 *
 * No user IDs, database errors, connection details or secrets are returned.
 * This is intentionally not a privileged or write-capable endpoint.
 */
export async function GET() {
  try {
    const { error } = await createPublicClient()
      .from("setups")
      .select("id")
      .limit(1);

    if (error) throw new Error("Public database read failed");
    return NextResponse.json({ status: "ok" }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ status: "unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}

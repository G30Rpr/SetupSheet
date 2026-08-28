import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Reads the current user once per server render. Anonymous requests skip the
 * network call entirely: there is no session to refresh when no Supabase auth
 * cookie is present. This matters because the root layout is shared by every
 * route, including public pages, and a dead Supabase project must not add a
 * timeout to every anonymous navigation.
 */
export const getCurrentUser = cache(async (supabase: ServerClient): Promise<User | null> => {
  const cookieStore = await cookies();
  if (!hasSupabaseAuthCookie(cookieStore.getAll().map(({ name }) => name))) {
    return null;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    logger.error("getCurrentUser: failed to fetch current user", error);
    return null;
  }
});

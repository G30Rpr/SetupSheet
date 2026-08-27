import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Reads the current session without allowing a transient auth network error to crash a route/action. */
export const getCurrentUser = cache(async (supabase: ServerClient): Promise<User | null> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    logger.error("getCurrentUser: failed to read auth session", error);
    return null;
  }
});

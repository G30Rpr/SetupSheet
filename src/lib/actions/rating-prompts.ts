"use server";

import { isUuid } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export type DismissRatingPromptResult = { ok: true } | { ok: false; error: string };

/**
 * Dismisses the 24h rating prompt for one (viewer, setup) pair. The prompt
 * is a nudge, not homework -- dismissal is one tap and permanent per pair.
 * Owner-only RLS (0041) scopes the write to the caller's own download rows.
 */
export async function dismissRatingPrompt(setupId: string): Promise<DismissRatingPromptResult> {
  if (!isUuid(setupId)) {
    return { ok: false, error: "That setup id is invalid." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Sign in to manage your rating prompts." };
    }

    const { error } = await supabase
      .from("setup_download_events")
      .update({ prompt_dismissed_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("setup_id", setupId)
      .is("prompt_dismissed_at", null);
    if (error) {
      return { ok: false, error: "Couldn't dismiss the prompt. Try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't dismiss the prompt. Try again." };
  }
}

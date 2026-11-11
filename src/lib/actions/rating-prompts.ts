"use server";

import { isUuid } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export type DismissRatingPromptResult = { ok: true } | { ok: false; error: string };

/**
 * Dismisses the 24h rating prompt for one (viewer, setup) pair. The prompt
 * is a nudge, not homework -- dismissal is one tap and permanent per pair.
 * Owner-only RLS scopes the write to the caller.
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
      .from("rating_prompt_dismissals")
      .upsert(
        { user_id: user.id, setup_id: setupId },
        { onConflict: "user_id,setup_id", ignoreDuplicates: true }
      );
    if (error) {
      return { ok: false, error: "Couldn't dismiss the prompt. Try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't dismiss the prompt. Try again." };
  }
}

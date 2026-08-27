"use server";

import { getSetupsAfter, type SetupCursor } from "@/lib/supabase/setups";
import { isUuid } from "@/lib/utils";
import type { Setup } from "@/lib/types";

export interface MoreSetupsResult {
  setups: Setup[];
  nextCursor: SetupCursor | null;
  error: string | null;
}

const ISO_CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Loads the next keyset page for the client-side browse index. */
export async function loadMoreSetups(cursor: SetupCursor): Promise<MoreSetupsResult> {
  if (
    !cursor ||
    typeof cursor.createdAt !== "string" ||
    cursor.createdAt.length > 64 ||
    !ISO_CURSOR_PATTERN.test(cursor.createdAt) ||
    Number.isNaN(Date.parse(cursor.createdAt)) ||
    !isUuid(cursor.id)
  ) {
    return { setups: [], nextCursor: null, error: "That browse cursor is invalid." };
  }

  try {
    return await getSetupsAfter(cursor);
  } catch {
    return {
      setups: [],
      nextCursor: null,
      error: "Couldn't load older setups right now.",
    };
  }
}

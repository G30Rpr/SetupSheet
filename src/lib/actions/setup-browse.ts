"use server";

import { normalizeBrowseFilters, type BrowseFilters } from "@/lib/browse-filters";
import { getSetupsAfter, type SetupCursor } from "@/lib/supabase/setups";
import { getPublicFieldTestCounts } from "@/lib/supabase/field-tests";
import { isUuid } from "@/lib/utils";
import type { Setup } from "@/lib/types";

export interface MoreSetupsResult {
  setups: Setup[];
  nextCursor: SetupCursor | null;
  fieldTestCounts: Record<string, number>;
  error: string | null;
}

const ISO_CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Loads the next keyset page for the client-side browse index. */
export async function loadMoreSetups(
  cursor: SetupCursor,
  filters: BrowseFilters
): Promise<MoreSetupsResult> {
  const normalizedFilters = normalizeBrowseFilters(filters);
  if (
    !normalizedFilters ||
    !cursor ||
    typeof cursor.createdAt !== "string" ||
    cursor.createdAt.length > 64 ||
    !ISO_CURSOR_PATTERN.test(cursor.createdAt) ||
    Number.isNaN(Date.parse(cursor.createdAt)) ||
    !isUuid(cursor.id)
  ) {
    return { setups: [], nextCursor: null, fieldTestCounts: {}, error: "That browse cursor is invalid." };
  }

  try {
    const result = await getSetupsAfter(cursor, normalizedFilters);
    if (result.error) return { ...result, fieldTestCounts: {} };

    const fieldTestCounts = await getPublicFieldTestCounts(result.setups.map((setup) => setup.id));
    return { ...result, fieldTestCounts: Object.fromEntries(fieldTestCounts) };
  } catch {
    return {
      setups: [],
      nextCursor: null,
      fieldTestCounts: {},
      error: "Couldn't load older setups right now.",
    };
  }
}

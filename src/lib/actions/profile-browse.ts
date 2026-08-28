"use server";

import { getSetupsByUserPage, type ProfileSetupPage, type SetupCursor } from "@/lib/supabase/setups";
import { isUuid } from "@/lib/utils";

const ISO_CURSOR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidCursor(cursor: unknown): cursor is SetupCursor {
  if (typeof cursor !== "object" || cursor === null || Array.isArray(cursor)) return false;
  const fields = cursor as Record<string, unknown>;

  return (
    typeof fields.createdAt === "string" &&
    fields.createdAt.length <= 64 &&
    ISO_CURSOR_PATTERN.test(fields.createdAt) &&
    !Number.isNaN(Date.parse(fields.createdAt)) &&
    isUuid(fields.id)
  );
}

/** Loads the next bounded page of public setups for a profile. */
export async function loadMoreProfileSetups(
  profileId: string,
  cursor: SetupCursor
): Promise<ProfileSetupPage> {
  if (!isUuid(profileId) || !isValidCursor(cursor)) {
    return {
      setups: [],
      nextCursor: null,
      error: "That profile page request is invalid.",
    };
  }

  try {
    return await getSetupsByUserPage(profileId, cursor);
  } catch {
    return {
      setups: [],
      nextCursor: null,
      error: "Couldn't load more profile setups right now.",
    };
  }
}

"use server";

import { getSetupVersions } from "@/lib/supabase/setup-versions";
import type { SetupVersion } from "@/lib/types";

/**
 * A read, not a mutation -- exists so the client-side "Version history"
 * panel on SetupCard can fetch on first expand rather than loading every
 * setup's history on every render of the browse grid.
 */
export async function getSetupVersionsAction(setupId: string): Promise<SetupVersion[]> {
  return getSetupVersions(setupId);
}

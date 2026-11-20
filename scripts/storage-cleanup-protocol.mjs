/** Claimed deletion only. An API error leaves the durable claim closed to
 * attachments; retries use the same claim and never reopen the path. */
export async function cleanupStoragePaths(
  supabase,
  paths,
  { grace, targetUser },
) {
  const claimed = [];
  let errors = 0;
  let skipped = 0;
  for (const path of paths) {
    const { data: claim, error } = await supabase.rpc("claim_storage_cleanup", {
      p_path: path,
      p_grace: grace,
      p_user: targetUser,
    });
    if (error) {
      errors++;
      continue;
    }
    if (claim === null) {
      skipped++;
      continue;
    }
    if (
      typeof claim !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        claim,
      )
    ) {
      errors++;
      continue;
    }
    claimed.push({ path, claim });
  }
  if (!claimed.length) return { deleted: 0, errors, skipped };
  const { error } = await supabase.storage
    .from("setup-files")
    .remove(claimed.map(({ path }) => path));
  if (error) return { deleted: 0, errors: errors + claimed.length, skipped };
  let deleted = 0;
  for (const { path, claim } of claimed) {
    // Do not trust the Storage response's object count: the database must
    // confirm metadata absence before releasing capacity. Empty API responses
    // can be legitimate retries after a worker crashed following removal.
    const { data: finished, error: finishError } = await supabase.rpc(
      "finish_storage_cleanup",
      {
        p_path: path,
        p_claim: claim,
      },
    );
    if (finishError || finished !== true) errors++;
    else deleted++;
  }
  return { deleted, errors, skipped };
}

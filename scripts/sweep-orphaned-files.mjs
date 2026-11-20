#!/usr/bin/env node
/**
 * scripts/sweep-orphaned-files.mjs
 *
 * Operational tool to detect and prune orphaned objects in the public `setup-files` bucket.
 * Uses the draft claim-based lifecycle RPCs; refuses legacy inventory-only deletion.
 *
 * Usage:
 *   # Dry run (list orphans older than 24 hours without deleting):
 *   node scripts/sweep-orphaned-files.mjs --dry-run
 *
 *   # Explicitly delete reviewed orphans older than 48 hours:
 *   node scripts/sweep-orphaned-files.mjs --apply --grace "48 hours"
 *
 *   # Delete eligible, unreferenced files for an account undergoing deletion:
 *   node scripts/sweep-orphaned-files.mjs --user <user-uuid> --apply --confirm-user-delete
 *
 * Environment variables:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { cleanupStoragePaths } from "./storage-cleanup-protocol.mjs";
import {
  parseStorageSweepArgs,
  validateCleanupPaths,
} from "./storage-gc-options.mjs";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let options;
try {
  options = parseStorageSweepArgs(process.argv.slice(2));
} catch (error) {
  console.error(
    "[Storage GC] Invalid arguments:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}
const { dryRun: isDryRun, grace: graceArg, targetUser, batchSize } = options;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Error: Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.error(
    "This script requires service-role privileges to inspect and prune Storage objects.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log("[Storage GC] Connecting to configured Supabase project...");
  if (isDryRun) {
    console.log("[Storage GC] MODE: DRY-RUN (no files will be deleted)");
  }

  let pathsToDelete = [];

  // Read-only inventory includes expired, never-uploaded reservations as
  // well as legacy blobs. Eligibility is rechecked atomically before removal.
  const { data, error } = await supabase.rpc("storage_cleanup_candidates", {
    p_grace: graceArg,
    p_user: targetUser,
  });
  if (error) throw new Error("Claim-based Storage inventory is unavailable");
  pathsToDelete = (data || []).map((row) => row.object_name);
  console.log(
    `[Storage GC] Found ${pathsToDelete.length} eligible candidate(s).`,
  );

  // Treat malformed RPC output as a hard failure, not a partial cleanup.
  // Only Storage objects under valid user folders may be removed.
  pathsToDelete = validateCleanupPaths(pathsToDelete, targetUser);

  if (pathsToDelete.length === 0) {
    console.log("[Storage GC] No files to prune. Done.");
    return;
  }

  if (isDryRun) {
    console.log(
      "[Storage GC] Dry-run complete; no files deleted. Object paths are omitted from CI logs.",
    );
    return;
  }

  console.log(
    `[Storage GC] Deleting ${pathsToDelete.length} object(s) in batches of ${batchSize}...`,
  );
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < pathsToDelete.length; i += batchSize) {
    const batch = pathsToDelete.slice(i, i + batchSize);
    const result = await cleanupStoragePaths(supabase, batch, {
      grace: graceArg,
      targetUser,
    });
    deletedCount += result.deleted;
    errorCount += result.errors;
    console.log(
      `[Storage GC] Batch ${Math.floor(i / batchSize) + 1}: ${result.deleted} completed, ${result.skipped} no longer eligible, ${result.errors} errors.`,
    );
  }

  console.log(
    `[Storage GC] Finished: ${deletedCount} deleted, ${errorCount} errors.`,
  );
  if (errorCount > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error("[Storage GC] Unexpected failure:", err);
  process.exit(1);
});

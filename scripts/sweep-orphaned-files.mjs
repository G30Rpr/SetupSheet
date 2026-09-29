#!/usr/bin/env node
/**
 * scripts/sweep-orphaned-files.mjs
 *
 * Operational tool to detect and prune orphaned objects in the public `setup-files` bucket.
 * Uses public.orphaned_setup_files() or public.setup_files_for_user() (from migration 0028).
 *
 * Usage:
 *   # Dry run (list orphans older than 24 hours without deleting):
 *   node scripts/sweep-orphaned-files.mjs --dry-run
 *
 *   # Delete orphans older than 48 hours:
 *   node scripts/sweep-orphaned-files.mjs --grace "48 hours"
 *
 *   # Delete all files for an account undergoing deletion:
 *   node scripts/sweep-orphaned-files.mjs --user <user-uuid>
 *
 * Environment variables:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

const graceArg = getArgValue("--grace") || "24 hours";
const targetUser = getArgValue("--user");
const batchSize = Math.max(1, parseInt(getArgValue("--batch-size") || "50", 10));

if (!supabaseUrl || !serviceKey) {
  console.error("Error: Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("This script requires service-role privileges to inspect and prune Storage objects.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log(`[Storage GC] Connecting to ${supabaseUrl}...`);
  if (isDryRun) {
    console.log("[Storage GC] MODE: DRY-RUN (no files will be deleted)");
  }

  let pathsToDelete = [];

  if (targetUser) {
    console.log(`[Storage GC] Enumerating files for deleted user: ${targetUser}...`);
    const { data, error } = await supabase.rpc("setup_files_for_user", {
      p_user_id: targetUser,
    });

    if (error) {
      console.error("[Storage GC] Failed to query setup_files_for_user:", error.message);
      process.exit(1);
    }

    pathsToDelete = (data || []).map((row) => row.object_name);
    console.log(`[Storage GC] Found ${pathsToDelete.length} object(s) belonging to user ${targetUser}.`);
  } else {
    console.log(`[Storage GC] Querying orphaned setup files older than grace window "${graceArg}"...`);
    const { data, error } = await supabase.rpc("orphaned_setup_files", {
      p_grace: graceArg,
    });

    if (error) {
      console.error("[Storage GC] Failed to query orphaned_setup_files:", error.message);
      process.exit(1);
    }

    pathsToDelete = (data || []).map((row) => row.object_name);
    console.log(`[Storage GC] Found ${pathsToDelete.length} orphaned object(s).`);
  }

  if (pathsToDelete.length === 0) {
    console.log("[Storage GC] No files to prune. Done.");
    return;
  }

  if (isDryRun) {
    console.log("[Storage GC] Dry-run complete. Files that would be deleted:");
    for (const path of pathsToDelete) {
      console.log(`  - ${path}`);
    }
    return;
  }

  console.log(`[Storage GC] Deleting ${pathsToDelete.length} object(s) in batches of ${batchSize}...`);
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < pathsToDelete.length; i += batchSize) {
    const batch = pathsToDelete.slice(i, i + batchSize);
    const { data, error } = await supabase.storage.from("setup-files").remove(batch);

    if (error) {
      console.error(`[Storage GC] Batch delete error at offset ${i}:`, error.message);
      errorCount += batch.length;
    } else {
      const successfulDeletes = data?.length || batch.length;
      deletedCount += successfulDeletes;
      console.log(`[Storage GC] Pruned batch ${Math.floor(i / batchSize) + 1} (${successfulDeletes} files)`);
    }
  }

  console.log(`[Storage GC] Finished: ${deletedCount} deleted, ${errorCount} errors.`);
}

run().catch((err) => {
  console.error("[Storage GC] Unexpected failure:", err);
  process.exit(1);
});

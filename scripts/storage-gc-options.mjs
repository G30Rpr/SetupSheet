const DEFAULT_GRACE = "24 hours";
const MAX_BATCH_SIZE = 100;

function parsePositiveInteger(text, flag, upperBound) {
  if (!/^[1-9][0-9]*$/.test(text ?? "")) {
    throw new Error(`${flag} must be a positive integer`);
  }
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n > upperBound) {
    throw new Error(`${flag} must be at most ${upperBound}`);
  }
  return n;
}

export function parseStorageSweepArgs(args) {
  let dryRun = false;
  let grace = DEFAULT_GRACE;
  let targetUser = null;
  let batchSize = 50;
  let confirmUserDelete = false;
  const seen = new Set();

  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!["--dry-run", "--grace", "--user", "--batch-size", "--confirm-user-delete"].includes(flag)) {
      throw new Error(`Unsupported argument: ${flag}`);
    }
    if (seen.has(flag)) throw new Error(`Repeated argument: ${flag}`);
    seen.add(flag);
    if (flag === "--dry-run") {
      dryRun = true;
    } else if (flag === "--confirm-user-delete") {
      confirmUserDelete = true;
    } else {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
      if (flag === "--grace") {
        const match = /^([1-9][0-9]{0,2}) (hours?|days?)$/.exec(value);
        if (!match) throw new Error("Grace must look like '24 hours' or '7 days'");
        const n = Number(match[1]);
        if (n * (match[2].startsWith("day") ? 24 : 1) > 720) {
          throw new Error("Grace period cannot exceed 30 days");
        }
        grace = value;
      } else if (flag === "--batch-size") {
        batchSize = parsePositiveInteger(value, flag, MAX_BATCH_SIZE);
      } else {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
          throw new Error("--user must be a UUID");
        }
        targetUser = value;
      }
    }
  }

  if (confirmUserDelete && !targetUser) {
    throw new Error("--confirm-user-delete requires --user");
  }
  if (targetUser && !dryRun && !confirmUserDelete) {
    throw new Error("Deleting a user's folder requires --confirm-user-delete; preview using --dry-run first");
  }
  return { dryRun, grace, targetUser, batchSize };
}

/** Validate backend-provided object paths before any destructive Storage API call. */
export function validateCleanupPaths(paths, targetUser = null) {
  if (!Array.isArray(paths)) throw new Error("Storage cleanup enumeration must be an array");
  const validFolder = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const result = new Set();
  for (const path of paths) {
    if (typeof path !== "string" || path.length > 512 || /[\\\\\u0000-\u001f\u007f]/.test(path)) {
      throw new Error("Backend returned an unsafe Storage path");
    }
    const [folder, fileName, extraPart] = path.split("/");
    if (!validFolder.test(folder) || !fileName || extraPart !== undefined ||
        fileName === "." || fileName === ".." || (targetUser && folder.toLowerCase() !== targetUser.toLowerCase())) {
      throw new Error("Backend returned a Storage path outside the approved owner folder");
    }
    result.add(path);
  }
  return [...result];
}

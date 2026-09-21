import {
  ALLOWED_SETUP_FILE_EXTENSIONS,
  ALLOWED_TELEMETRY_FILE_EXTENSIONS,
  getFileExtension,
  MAX_SETUP_FILE_BYTES,
  MAX_STORED_FILE_NAME_LENGTH,
  MAX_STORAGE_PATH_LENGTH,
  MAX_TELEMETRY_FILE_BYTES,
  sanitizeFileName,
} from "@/lib/storage";
import { isUuid } from "@/lib/utils";

export type UploadKind = "setup" | "telemetry";

export interface UploadTarget {
  /** Object path inside the `setup-files` bucket: `<userId>/<id>-<name>`. */
  path: string;
  /** Sanitized name to store in the database and show as the download name. */
  fileName: string;
  kind: UploadKind;
}

export interface UploadTargetResult {
  target: UploadTarget | null;
  error: string | null;
}

const UPLOAD_RULES: Record<
  UploadKind,
  {
    maxBytes: number;
    allowedExtensions: readonly string[];
    objectPrefix: string;
    label: string;
    maxSizeLabel: string;
  }
> = {
  setup: {
    maxBytes: MAX_SETUP_FILE_BYTES,
    allowedExtensions: ALLOWED_SETUP_FILE_EXTENSIONS,
    objectPrefix: "",
    label: "Setup file",
    maxSizeLabel: "5 MB",
  },
  telemetry: {
    maxBytes: MAX_TELEMETRY_FILE_BYTES,
    allowedExtensions: ALLOWED_TELEMETRY_FILE_EXTENSIONS,
    objectPrefix: "telemetry-",
    label: "Telemetry file",
    maxSizeLabel: "10 MB",
  },
};

export function isUploadKind(value: unknown): value is UploadKind {
  return value === "setup" || value === "telemetry";
}

/**
 * Validates an upload *before* any bytes move, and derives the Storage object
 * path the browser is allowed to write to.
 *
 * This runs in two places for two different reasons:
 *
 * 1. In the browser, right after the user picks a file, so a bad file fails
 *    instantly instead of after a multi-megabyte round trip.
 * 2. In `createUploadTarget` (Server Action), because the browser is not a
 *    trust boundary -- the path that comes back here is the one embedded in
 *    the signed upload URL, and it must always be inside the caller's own
 *    Storage folder.
 *
 * It is deliberately pure (no Supabase, no `fetch`) so both callers and the
 * unit tests exercise exactly the same rules. `makeId` is injectable so paths
 * are deterministic under test.
 */
export function describeUploadTarget(
  kind: UploadKind,
  rawFileName: unknown,
  fileSize: unknown,
  ownerId: unknown,
  makeId: () => string = () => crypto.randomUUID()
): UploadTargetResult {
  const rule = UPLOAD_RULES[kind];

  // A Storage object must live inside the uploader's own folder. Without a
  // valid user id there is no folder to write to, so this is the auth check
  // for path purposes even though the action also checks the session.
  if (typeof ownerId !== "string" || !isUuid(ownerId)) {
    return {
      target: null,
      error: "You need to be logged in with Discord to upload a file.",
    };
  }

  if (typeof rawFileName !== "string" || rawFileName.length === 0) {
    return { target: null, error: `No ${rule.label.toLowerCase()} selected.` };
  }

  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return { target: null, error: `That ${rule.label.toLowerCase()} is empty or unreadable.` };
  }

  if (fileSize > rule.maxBytes) {
    return {
      target: null,
      error: `${rule.label} is too large — max ${rule.maxSizeLabel}.`,
    };
  }

  const extension = getFileExtension(rawFileName);
  if (!rule.allowedExtensions.includes(extension)) {
    return {
      target: null,
      error: `Unsupported ${rule.label.toLowerCase()} format. Allowed: ${rule.allowedExtensions.join(", ")}`,
    };
  }

  const fileName = sanitizeFileName(rawFileName);
  // `sanitizeFileName` guarantees a non-empty result, but it can still return
  // something longer than the limit when the input had no extension to
  // preserve -- the stored filename has its own column-length contract.
  if (fileName.length > MAX_STORED_FILE_NAME_LENGTH) {
    return { target: null, error: `${rule.label} name is too long.` };
  }

  const path = `${ownerId}/${rule.objectPrefix}${makeId()}-${fileName}`;
  // Storage policies key off `<folder>/<name>`, so a path that somehow grew a
  // separator would be rejected in the database anyway -- checking here keeps
  // the failure in the app where it can be explained to the user.
  if (path.length > MAX_STORAGE_PATH_LENGTH || path.split("/").length !== 2) {
    return { target: null, error: `${rule.label} name is too long.` };
  }

  return { target: { path, fileName, kind }, error: null };
}

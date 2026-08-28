export const SETUP_FILES_BUCKET = "setup-files";
export const MAX_SETUP_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TELEMETRY_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_STORAGE_PATH_LENGTH = 512;
export const MAX_STORED_FILE_NAME_LENGTH = 255;

/**
 * Must cover every extension install-guides.ts tells users to download for
 * a `supportsFileImport: true` game -- .sto (iRacing), .json (ACC), .ini
 * (Assetto Corsa), .svm (Le Mans Ultimate, Automobilista 2). The rest are a
 * generic fallback for anything else close enough to plain text/data.
 */
export const ALLOWED_SETUP_FILE_EXTENSIONS = [
  ".sto",
  ".json",
  ".ini",
  ".svm",
  ".sav",
  ".txt",
  ".xml",
  ".csv",
];

/**
 * Common telemetry, data logging, and replay formats across sim racing analysis tools:
 * MoTeC i3 (.ld, .ldx), iRacing telemetry (.ibt), VBOX (.vbo), TrackVision/AiM (.drf),
 * CSV logs (.csv), zipped telemetry packs (.zip, .zvp).
 */
export const ALLOWED_TELEMETRY_FILE_EXTENSIONS = [
  ".ld",
  ".ldx",
  ".ibt",
  ".vbo",
  ".drf",
  ".csv",
  ".zip",
  ".zvp",
  ".telemetry",
];

/** Replaces path-sensitive/control characters before a name is used in Storage. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  if (cleaned.length <= MAX_STORED_FILE_NAME_LENGTH) return cleaned || "setup-file";

  // Preserve the extension when a browser supplies an unusually long name;
  // otherwise the upload would pass extension validation, then fail again
  // when the generated database filename is checked.
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 ? cleaned.slice(dot) : "";
  if (extension.length >= MAX_STORED_FILE_NAME_LENGTH) {
    return cleaned.slice(0, MAX_STORED_FILE_NAME_LENGTH);
  }
  return `${cleaned.slice(0, MAX_STORED_FILE_NAME_LENGTH - extension.length)}${extension}`;
}

/** Makes a database filename safe to render/use as a download attribute. */
export function sanitizeStoredFileName(name: unknown): string | null {
  if (typeof name !== "string" || !name) return null;
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, MAX_STORED_FILE_NAME_LENGTH);
  return cleaned || null;
}

/**
 * Storage objects created by this app have exactly one path component for
 * the uploader followed by one generated object name. Checking that shape
 * before turning a database value into a URL prevents a setup from pointing
 * at another user's object or a path containing traversal components.
 */
export function isOwnedStoragePath(path: unknown, ownerId: string): path is string {
  if (typeof path !== "string" || !ownerId || path.length > MAX_STORAGE_PATH_LENGTH) {
    return false;
  }

  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== ownerId || !parts[1]) return false;
  if (parts[1] === "." || parts[1] === "..") return false;
  return !/[\\\u0000-\u001f\u007f]/.test(parts[1]);
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

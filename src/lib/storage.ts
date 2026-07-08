export const SETUP_FILES_BUCKET = "setup-files";
export const MAX_SETUP_FILE_BYTES = 5 * 1024 * 1024;

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

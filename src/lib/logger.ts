type LogLevel = "error" | "warn" | "info";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  error?: unknown;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

/**
 * Minimal structured-logging shim: same information that was already going
 * to console.error/warn/info, just shaped as one JSON line so a log
 * aggregator (or a human scanning Vercel's log viewer) can filter/parse
 * reliably instead of eyeballing free-text prefixes. Still ultimately
 * stdout/stderr -- no external service, no new dependency.
 */
function log(level: LogLevel, message: string, error?: unknown) {
  const entry: LogEntry = { level, message, timestamp: new Date().toISOString() };
  if (error !== undefined) entry.error = serializeError(error);

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  error: (message: string, error?: unknown) => log("error", message, error),
  warn: (message: string, error?: unknown) => log("warn", message, error),
  info: (message: string, error?: unknown) => log("info", message, error),
};

interface DatabaseErrorLike {
  code?: unknown;
  message?: unknown;
}

/**
 * Converts database/service errors into stable UI text. Detailed errors are
 * logged at the action boundary; returning the raw PostgREST message leaks
 * schema/constraint details and makes the UI depend on backend wording.
 */
export function getActionError(
  error: unknown,
  fallback: string,
  knownMessages: readonly string[] = []
): string {
  const candidate = error as DatabaseErrorLike | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  if (knownMessages.includes(message)) return message;

  switch (candidate?.code) {
    case "23505":
      return "That action has already been applied.";
    case "23503":
      return "The referenced item no longer exists.";
    case "42501":
      return "You are not allowed to perform that action.";
    default:
      return fallback;
  }
}

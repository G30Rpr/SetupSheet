import type { SetupValues } from "@/lib/types";

/**
 * What to send as a setup's setup_values on submit. Manual entry always
 * sends the typed values; file mode sends whatever this session's upload
 * parsed (see acc-setup-parser.ts), if anything. The remaining two cases
 * only matter when editing: keeping the existing file untouched must leave
 * setup_values alone (a *prior* parse may have attached values to that same
 * file, and this edit isn't replacing it), while anything else in file mode
 * -- a new file that didn't parse to anything, or abandoning file mode
 * with nothing kept -- explicitly clears it.
 */
export function resolveEffectiveSetupValues({
  entryMode,
  manualSetupValues,
  detectedSetupValues,
  isEditing,
  keepExistingFile,
  hasNewFile,
}: {
  entryMode: "file" | "manual";
  manualSetupValues: SetupValues;
  detectedSetupValues: SetupValues;
  isEditing: boolean;
  keepExistingFile: boolean;
  hasNewFile: boolean;
}): SetupValues | null | undefined {
  if (entryMode === "manual") {
    return manualSetupValues;
  }
  if (Object.keys(detectedSetupValues).length > 0) {
    return detectedSetupValues;
  }
  if (isEditing && keepExistingFile && !hasNewFile) {
    return undefined;
  }
  return null;
}

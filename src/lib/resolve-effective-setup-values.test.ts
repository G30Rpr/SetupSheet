import { describe, expect, it } from "vitest";

import { resolveEffectiveSetupValues } from "@/lib/resolve-effective-setup-values";

const base = {
  entryMode: "file" as const,
  manualSetupValues: {},
  detectedSetupValues: {},
  isEditing: false,
  keepExistingFile: false,
  hasNewFile: false,
};

describe("resolveEffectiveSetupValues", () => {
  it("sends the manually-typed values in manual mode, regardless of file state", () => {
    const manual = { frontTirePressure: "23.5 psi" };
    expect(
      resolveEffectiveSetupValues({ ...base, entryMode: "manual", manualSetupValues: manual })
    ).toBe(manual);
  });

  it("sends this session's auto-parsed values when a file produced any", () => {
    const detected = { frontLeftCamber: "-3.20°" };
    expect(
      resolveEffectiveSetupValues({ ...base, entryMode: "file", detectedSetupValues: detected })
    ).toBe(detected);
  });

  it("leaves setup_values untouched when editing and keeping the existing file with no new upload", () => {
    expect(
      resolveEffectiveSetupValues({
        ...base,
        entryMode: "file",
        isEditing: true,
        keepExistingFile: true,
        hasNewFile: false,
      })
    ).toBeUndefined();
  });

  it("clears setup_values on a fresh create in file mode with nothing parsed", () => {
    expect(resolveEffectiveSetupValues({ ...base, entryMode: "file", isEditing: false })).toBeNull();
  });

  it("clears setup_values when a new file this session didn't parse to anything", () => {
    expect(
      resolveEffectiveSetupValues({
        ...base,
        entryMode: "file",
        isEditing: true,
        keepExistingFile: true,
        hasNewFile: true,
      })
    ).toBeNull();
  });

  it("clears setup_values when abandoning manual/file entry with nothing kept", () => {
    expect(
      resolveEffectiveSetupValues({
        ...base,
        entryMode: "file",
        isEditing: true,
        keepExistingFile: false,
        hasNewFile: false,
      })
    ).toBeNull();
  });
});

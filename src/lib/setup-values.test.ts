import { describe, expect, it } from "vitest";

import {
  MAX_SETUP_VALUE_COUNT,
  MAX_SETUP_VALUE_LENGTH,
  normalizeSetupValues,
} from "@/lib/setup-values";

describe("normalizeSetupValues", () => {
  it("keeps a plain string map and uses a null prototype", () => {
    const values = normalizeSetupValues({ frontArb: "3", rearArb: "2" });
    expect(values).toEqual({ frontArb: "3", rearArb: "2" });
    if (values) expect(Object.getPrototypeOf(values)).toBeNull();
  });

  it("rejects non-object, nested, and oversized values", () => {
    expect(normalizeSetupValues(["3"])).toBeNull();
    expect(normalizeSetupValues({ frontArb: { value: 3 } })).toBeNull();
    expect(normalizeSetupValues({ frontArb: "x".repeat(MAX_SETUP_VALUE_LENGTH + 1) })).toBeNull();

    const tooMany = Object.fromEntries(
      Array.from({ length: MAX_SETUP_VALUE_COUNT + 1 }, (_, i) => [`field${i}`, "1"])
    );
    expect(normalizeSetupValues(tooMany)).toBeNull();
  });

  it("treats null and undefined as no structured values", () => {
    expect(normalizeSetupValues(null)).toBeNull();
    expect(normalizeSetupValues(undefined)).toBeNull();
  });
});

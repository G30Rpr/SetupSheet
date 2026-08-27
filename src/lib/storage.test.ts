import { describe, expect, it } from "vitest";

import {
  isOwnedStoragePath,
  sanitizeFileName,
} from "@/lib/storage";

const userId = "11111111-1111-4111-8111-111111111111";

describe("Storage path and filename guards", () => {
  it("accepts only a two-component path in the owner's folder", () => {
    expect(isOwnedStoragePath(`${userId}/object.json`, userId)).toBe(true);
    expect(isOwnedStoragePath(`other-user/object.json`, userId)).toBe(false);
    expect(isOwnedStoragePath(`${userId}/../object.json`, userId)).toBe(false);
    expect(isOwnedStoragePath(`${userId}/nested/object.json`, userId)).toBe(false);
  });

  it("removes path/control characters and keeps long-file extensions", () => {
    expect(sanitizeFileName("../setup\n.json")).toBe(".._setup_.json");
    const longName = `${"x".repeat(300)}.ibt`;
    const safe = sanitizeFileName(longName);
    expect(safe.endsWith(".ibt")).toBe(true);
    expect(safe.length).toBeLessThanOrEqual(255);
  });
});

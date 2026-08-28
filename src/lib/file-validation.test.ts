import { describe, expect, it } from "vitest";

import { validateFileSignature } from "@/lib/file-validation";

describe("validateFileSignature", () => {
  it("accepts valid JSON and rejects malformed JSON", async () => {
    expect(await validateFileSignature(new Blob(['{"setup":true}']), ".json")).toBeNull();
    expect(await validateFileSignature(new Blob(["not json"]), ".json")).toContain(
      "does not match"
    );
  });

  it("checks ZIP magic bytes", async () => {
    expect(
      await validateFileSignature(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]), ".zip")
    ).toBeNull();
    expect(await validateFileSignature(new Blob(["plain text"]), ".zip")).toContain(
      "valid ZIP"
    );
  });

  it("rejects binary data in text-oriented formats but leaves opaque simulator formats alone", async () => {
    expect(
      await validateFileSignature(new Blob([new Uint8Array([0x7b, 0x00, 0x7d])]), ".txt")
    ).toContain("binary data");
    expect(await validateFileSignature(new Blob([new Uint8Array([0x00, 0xff])]), ".sto")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { describeUploadTarget } from "@/lib/upload-targets";

const USER_ID = "7ec21b4c-4a9b-4044-b2be-f6929af9be6a";
const nextId = () => "11111111-2222-3333-4444-555555555555";

describe("describeUploadTarget", () => {
  it("builds an owner-scoped path for a valid setup file", () => {
    const { target, error } = describeUploadTarget(
      "setup",
      "Monza Q.json",
      1024,
      USER_ID,
      nextId
    );

    expect(error).toBeNull();
    expect(target?.path).toBe(`${USER_ID}/11111111-2222-3333-4444-555555555555-Monza_Q.json`);
    expect(target?.fileName).toBe("Monza_Q.json");
  });

  it("prefixes telemetry objects so they are distinguishable from setup files", () => {
    const { target } = describeUploadTarget("telemetry", "run.vbo", 2048, USER_ID, nextId);

    expect(target?.path).toContain(`${USER_ID}/telemetry-11111111-2222-3333-4444-555555555555-run.vbo`);
  });

  it("requires an authenticated uuid owner, since the path embeds the folder", () => {
    expect(describeUploadTarget("setup", "a.json", 10, null, nextId).error).toContain(
      "logged in"
    );
    expect(describeUploadTarget("setup", "a.json", 10, "not-a-uuid", nextId).error).toContain(
      "logged in"
    );
  });

  it("rejects files over the per-kind size limit with that limit in the message", () => {
    const setupError = describeUploadTarget("setup", "a.json", 6 * 1024 * 1024, USER_ID, nextId).error;
    expect(setupError).toContain("5 MB");

    // 6 MB is fine for telemetry, 11 MB is not.
    expect(describeUploadTarget("telemetry", "a.vbo", 6 * 1024 * 1024, USER_ID, nextId).error).toBeNull();
    expect(describeUploadTarget("telemetry", "a.vbo", 11 * 1024 * 1024, USER_ID, nextId).error).toContain(
      "10 MB"
    );
  });

  it("accepts a file at exactly the limit and rejects an empty one", () => {
    expect(describeUploadTarget("setup", "a.json", 5 * 1024 * 1024, USER_ID, nextId).error).toBeNull();
    expect(describeUploadTarget("setup", "a.json", 0, USER_ID, nextId).error).toContain("empty");
  });

  it("enforces the extension allow-list per kind", () => {
    // .vbo is a telemetry format, not a setup file.
    expect(describeUploadTarget("setup", "run.vbo", 100, USER_ID, nextId).error).toContain(
      "Unsupported"
    );
    expect(describeUploadTarget("telemetry", "run.vbo", 100, USER_ID, nextId).error).toBeNull();
    expect(describeUploadTarget("setup", "payload.html", 100, USER_ID, nextId).error).toContain(
      "Unsupported"
    );
  });

  it("sanitizes path separators and control characters out of the stored name", () => {
    const { target } = describeUploadTarget("setup", "../../etc/pa\u0000ss.json", 100, USER_ID, nextId);

    expect(target?.fileName).not.toContain("/");
    expect(target?.fileName).not.toContain("\u0000");
    expect(target?.path.split("/")).toHaveLength(2);
    expect(target?.path.startsWith(`${USER_ID}/`)).toBe(true);
  });

  it("rejects a filename without a usable extension", () => {
    expect(describeUploadTarget("setup", "setupfile", 100, USER_ID, nextId).error).toContain(
      "Unsupported"
    );
    expect(describeUploadTarget("setup", "", 100, USER_ID, nextId).error).toContain("No setup file");
  });

  it("never lets a caller-supplied name escape the owner folder", () => {
    const { target } = describeUploadTarget("setup", "a.json", 100, USER_ID, nextId);
    expect(target?.path.startsWith(`${USER_ID}/`)).toBe(true);
    expect(target?.path).not.toContain("..");
  });
});

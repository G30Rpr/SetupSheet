import { describe, expect, it } from "vitest";

import { buildAuthCallbackUrl, sanitizeInternalRedirectPath } from "@/lib/auth-redirect";

describe("auth redirect paths", () => {
  it("keeps same-origin relative return paths in the OAuth callback URL", () => {
    expect(buildAuthCallbackUrl("https://setupsheet.example", "/garage?from=setup-id")).toBe(
      "https://setupsheet.example/auth/callback?next=%2Fgarage%3Ffrom%3Dsetup-id"
    );
  });

  it("does not carry protocol-relative, backslash, or absolute destinations", () => {
    expect(sanitizeInternalRedirectPath("//attacker.example/path")).toBeNull();
    expect(sanitizeInternalRedirectPath("/\\attacker.example")).toBeNull();
    expect(sanitizeInternalRedirectPath("https://attacker.example")).toBeNull();
    expect(buildAuthCallbackUrl("https://setupsheet.example", "//attacker.example")).toBe(
      "https://setupsheet.example/auth/callback"
    );
  });
});

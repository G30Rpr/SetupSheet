import { describe, expect, it } from "vitest";

import { sanitizeRedirectUrl } from "./route";

describe("sanitizeRedirectUrl", () => {
  it("defaults to root '/' when null or empty", () => {
    expect(sanitizeRedirectUrl(null)).toBe("/");
    expect(sanitizeRedirectUrl("")).toBe("/");
  });

  it("allows valid relative paths", () => {
    expect(sanitizeRedirectUrl("/setups")).toBe("/setups");
    expect(sanitizeRedirectUrl("/requests?game=iRacing")).toBe("/requests?game=iRacing");
    expect(sanitizeRedirectUrl("/profile/123")).toBe("/profile/123");
  });

  it("blocks open redirect attempts using protocol-relative syntax", () => {
    expect(sanitizeRedirectUrl("//attacker.com")).toBe("/");
    expect(sanitizeRedirectUrl("//evil.com/phishing")).toBe("/");
  });

  it("blocks open redirect attempts using backslashes", () => {
    expect(sanitizeRedirectUrl("/\\attacker.com")).toBe("/");
  });

  it("blocks absolute URLs", () => {
    expect(sanitizeRedirectUrl("https://attacker.com")).toBe("/");
    expect(sanitizeRedirectUrl("http://attacker.com")).toBe("/");
  });
});

import { describe, expect, it } from "vitest";

import { normalizeHttpsUrl } from "@/lib/safe-url";

describe("normalizeHttpsUrl", () => {
  it("keeps ordinary HTTPS image URLs", () => {
    expect(normalizeHttpsUrl("https://cdn.discordapp.com/avatars/user/avatar.png")).toBe(
      "https://cdn.discordapp.com/avatars/user/avatar.png"
    );
  });

  it("rejects non-HTTPS and malformed metadata values", () => {
    expect(normalizeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpsUrl("data:image/svg+xml,<svg></svg>")).toBeNull();
    expect(normalizeHttpsUrl("http://cdn.example/avatar.png")).toBeNull();
    expect(normalizeHttpsUrl("https://user:pass@cdn.example/avatar.png")).toBeNull();
    expect(normalizeHttpsUrl({})).toBeNull();
  });
});

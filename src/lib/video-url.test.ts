import { describe, expect, it } from "vitest";

import { normalizeVideoUrl, validateVideoUrl } from "@/lib/video-url";

describe("video URL validation", () => {
  it("allows HTTPS YouTube and Twitch links", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/watch?v=abc123_-")).toBe(
      "https://www.youtube.com/watch?v=abc123_-"
    );
    expect(normalizeVideoUrl("youtu.be/abc123_-")).toBe("https://youtu.be/abc123_-");
    expect(normalizeVideoUrl("https://clips.twitch.tv/example-clip")).toBe(
      "https://clips.twitch.tv/example-clip"
    );
  });

  it("rejects HTTP, credentials, custom ports, and lookalike hosts", () => {
    for (const value of [
      "http://www.youtube.com/watch?v=abc123",
      "https://www.youtube.com.evil.example/watch?v=abc123",
      "https://youtube.com@evil.example/watch?v=abc123",
      "https://www.youtube.com:443/watch?v=abc123",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
    ]) {
      expect(normalizeVideoUrl(value)).toBeNull();
      expect(validateVideoUrl(value)).toMatch(/YouTube or Twitch HTTPS link/);
    }
  });

  it("treats an empty optional field as absent", () => {
    expect(normalizeVideoUrl(null)).toBeNull();
    expect(normalizeVideoUrl("  ")).toBeNull();
    expect(validateVideoUrl("")).toBeNull();
  });

  it("rejects non-string and overlong values", () => {
    expect(validateVideoUrl(42)).toMatch(/YouTube or Twitch HTTPS link/);
    expect(validateVideoUrl(`https://youtube.com/${"x".repeat(2049)}`)).toMatch(/too long/);
  });
});

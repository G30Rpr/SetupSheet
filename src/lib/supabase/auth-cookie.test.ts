import { describe, expect, it } from "vitest";

import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";

describe("hasSupabaseAuthCookie", () => {
  it("recognizes the base and chunked Supabase session cookies", () => {
    expect(hasSupabaseAuthCookie(["sb-example-auth-token"])).toBe(true);
    expect(hasSupabaseAuthCookie(["sb-example-auth-token.0", "sb-example-auth-token.1"])).toBe(true);
  });

  it("does not treat unrelated cookies as an authenticated session", () => {
    expect(hasSupabaseAuthCookie(["theme=dark", "cookie-consent=yes"])).toBe(false);
    expect(hasSupabaseAuthCookie([])).toBe(false);
  });
});

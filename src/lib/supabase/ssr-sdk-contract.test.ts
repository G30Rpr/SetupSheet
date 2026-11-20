import { createServerClient } from "@supabase/ssr";
import { describe, expect, it, vi } from "vitest";

// Exercise the installed SSR/Auth SDKs together, with only HTTP and browser
// cookies substituted. No hosted project or external OAuth provider is used.
function setup() {
  const jar = new Map<string, string>();
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "synthetic rejected code",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
  );
  const client = () =>
    createServerClient("https://contract.supabase.co", "synthetic-public-key", {
      global: { fetch },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            if (options.maxAge === 0) jar.delete(name);
            else jar.set(name, value);
          }
        },
      },
    });
  const start = async () => {
    const { data, error } = await client().auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: "https://setupsheet.example/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(error).toBeNull();
    const flowId = data.flowId;
    expect(flowId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    return flowId!;
  };
  return { jar, fetch, client, start };
}

describe("Supabase SSR/Auth PKCE contract", () => {
  it("flushes a failed flow's verifier removal while preserving another pending flow", async () => {
    const { jar, fetch, client, start } = setup();
    const first = await start();
    const second = await start();
    const firstSlot = `sb-contract-auth-token-flow-${first}-code-verifier`;
    const secondSlot = `sb-contract-auth-token-flow-${second}-code-verifier`;
    expect(jar.has(firstSlot)).toBe(true);
    expect(jar.has(secondSlot)).toBe(true);
    const { error } = await client().auth.exchangeCodeForSession(
      "synthetic-code",
      { flowId: first },
    );
    expect(error).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(jar.has(firstSlot)).toBe(false);
    expect(jar.has(secondSlot)).toBe(true);
  });

  it.each(["", "invalid!", "unknown_flow123"])(
    "never borrows another flow's verifier for %s",
    async (flowId) => {
      const { jar, fetch, client, start } = setup();
      const pending = await start();
      const { error } = await client().auth.exchangeCodeForSession(
        "synthetic-code",
        { flowId },
      );
      expect(error).not.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      expect(
        jar.has(`sb-contract-auth-token-flow-${pending}-code-verifier`),
      ).toBe(true);
    },
  );
});

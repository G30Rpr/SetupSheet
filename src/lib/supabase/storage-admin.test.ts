import { afterEach, describe, expect, it, vi } from "vitest";
import { createStorageAdminClient } from "./storage-admin";
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ synthetic: true })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("server Storage signer configuration", () => {
  it("fails closed without a private credential", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    expect(createStorageAdminClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
  it("uses the server credential without adopting the browser session", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-private-key");
    createStorageAdminClient();
    expect(createClient).toHaveBeenCalledWith(
      "https://synthetic.supabase.co",
      "synthetic-private-key",
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }),
    );
  });
});

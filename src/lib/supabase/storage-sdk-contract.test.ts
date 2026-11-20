import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response("synthetic setup bytes"),
  );
  const client = createClient(
    "https://contract.supabase.co",
    "synthetic-public-key",
    {
      global: { fetch },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  return { files: client.storage.from("setup-files"), fetch };
}

describe("Supabase Storage SDK request boundaries", () => {
  it.each([
    "../other-bucket/private.json",
    "%2e%2e/other-bucket/private.json",
    "folder/../../other-bucket/private.json",
    "..\\other-bucket\\private.json",
  ])(
    "rejects an object path that escapes its bucket before sending HTTP: %s",
    async (path) => {
      const { files, fetch } = setup();
      const download = await files.download(path);
      expect(download.error?.message).toMatch(
        /escapes the intended bucket endpoint/,
      );
      const signed = await files.createSignedUploadUrl(path);
      expect(signed.error?.message).toMatch(
        /escapes the intended bucket endpoint/,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("keeps an ordinary download within the expected bucket", async () => {
    const { files, fetch } = setup();
    const { data, error } = await files.download("owner/setup.json");
    expect(error).toBeNull();
    expect(await data?.text()).toBe("synthetic setup bytes");
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://contract.supabase.co/storage/v1/object/setup-files/owner/setup.json",
    );
  });
});

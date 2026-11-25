import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createUploadHandler } from "../../supabase/functions/storage-upload/handler.ts";

describe("Edge user verification versus privileged SDK context", () => {
  it("uses the caller token only for Auth verification and keeps RPC/Storage server-only", async () => {
    const owner = "76000000-0000-4000-8000-000000000001";
    const path = `${owner}/file.json`;
    const calls: { path: string; authorization: string | null }[] = [];
    const client = createClient(
      "https://contract.supabase.co",
      "synthetic-service-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: async (input, init) => {
            const url = new URL(String(input));
            calls.push({
              path: url.pathname,
              authorization: new Headers(init?.headers).get("authorization"),
            });
            let body: unknown;
            if (url.pathname === "/auth/v1/user")
              body = { id: owner, app_metadata: {}, user_metadata: {} };
            else if (url.pathname === "/rest/v1/rpc/begin_storage_upload")
              body = { path, kind: "setup" };
            else if (url.pathname.startsWith("/storage/v1/object/setup-files/"))
              body = { Key: `setup-files/${path}`, Id: "synthetic-object" };
            else if (url.pathname === "/rest/v1/rpc/complete_storage_upload")
              body = true;
            else throw new Error("Unexpected synthetic HTTP request");
            return new Response(JSON.stringify(body), {
              headers: { "Content-Type": "application/json" },
            });
          },
        },
      },
    );
    const response = await createUploadHandler({
      admin: client,
      origins: ["https://app.example"],
    })(
      new Request("https://contract.supabase.co/functions/v1/storage-upload", {
        method: "POST",
        body: "{}",
        headers: {
          Origin: "https://app.example",
          Authorization: "Bearer synthetic-user-token",
          "x-upload-ticket": "76000000-0000-4000-8000-000000000002",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(4);
    expect(calls[0]).toEqual({
      path: "/auth/v1/user",
      authorization: "Bearer synthetic-user-token",
    });
    expect(
      calls
        .slice(1)
        .every((call) => call.authorization === "Bearer synthetic-service-key"),
    ).toBe(true);
    expect(await response.text()).not.toContain("synthetic-service-key");
  });
});

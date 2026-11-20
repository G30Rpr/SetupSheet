import { validateFileSignature } from "../_shared/file-validation.ts";

type RpcResult = { data: unknown; error: unknown };
export interface UploadAdmin {
  auth: {
    getUser(
      token: string,
    ): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options: { upsert: boolean; contentType: string },
      ): PromiseLike<RpcResult>;
    };
  };
}

async function readBytes(request: Request, max: number, timeoutMs: number) {
  if (Number(request.headers.get("content-length")) > max || !request.body)
    return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(max);
  const deadline = performance.now() + timeoutMs;
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    while (true) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) return null;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Upload deadline")),
          remaining,
        );
      });
      const { done, value } = await Promise.race([reader.read(), timeout]);
      clearTimeout(timer);
      if (performance.now() >= deadline) return null;
      if (done) break;
      if (value.byteLength > max - size) return null;
      bytes.set(value, size);
      size += value.byteLength;
    }
    return size ? bytes.subarray(0, size) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Pure request handler for both Deno deployment and real-stream Node tests.
 * No provider upload tokens are created, exposed or accepted here. */
export function createUploadHandler(options: {
  admin: UploadAdmin;
  origins: string[];
  bodyTimeoutMs?: number;
}) {
  const { admin, origins, bodyTimeoutMs = 20_000 } = options;
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const allowed = origin !== null && origins.includes(origin);
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    });
    if (allowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set(
        "Access-Control-Allow-Headers",
        "authorization, apikey, content-type, x-upload-ticket",
      );
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    }
    const reply = (status: number, error?: string) => {
      void request.body?.cancel().catch(() => {});
      return new Response(JSON.stringify(error ? { error } : { ok: true }), {
        status,
        headers,
      });
    };
    if (!allowed) return reply(403, "Origin not allowed");
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply(405, "Method not allowed");
    const authorization = request.headers.get("authorization");
    const ticket = request.headers.get("x-upload-ticket");
    if (
      !authorization?.startsWith("Bearer ") ||
      !ticket ||
      !/^[0-9a-f-]{36}$/i.test(ticket)
    ) {
      return reply(401, "Authentication and upload ticket required");
    }
    try {
      // Verify against Auth. A decoded JWT or user_metadata is never authority.
      const { data: auth, error: authError } = await admin.auth.getUser(
        authorization.slice(7),
      );
      if (authError || !auth.user) return reply(401, "Sign in to upload");
      const { data, error } = await admin.rpc("begin_storage_upload", {
        p_reservation: ticket,
        p_owner: auth.user.id,
      });
      if (
        error ||
        !data ||
        typeof data !== "object" ||
        !("path" in data) ||
        !("kind" in data) ||
        typeof data.path !== "string" ||
        !data.path.startsWith(`${auth.user.id}/`) ||
        (data.kind !== "setup" && data.kind !== "telemetry")
      )
        return reply(409, "Upload ticket is unavailable");
      const max = (data.kind === "setup" ? 5 : 10) * 1024 * 1024;
      const bytes = await readBytes(request, max, bodyTimeoutMs);
      if (!bytes)
        return reply(
          413,
          "Upload is empty, too large, or did not finish in time",
        );
      const extension = data.path
        .slice(data.path.lastIndexOf("."))
        .toLowerCase();
      const invalid = await validateFileSignature(new Blob([bytes]), extension);
      if (invalid) return reply(400, invalid);
      const uploaded = await admin.storage
        .from("setup-files")
        .upload(data.path, bytes, {
          upsert: false,
          contentType: "application/octet-stream",
        });
      if (uploaded.error) return reply(502, "Upload could not be confirmed");
      const completed = await admin.rpc("complete_storage_upload", {
        p_reservation: ticket,
      });
      if (completed.error || completed.data !== true)
        return reply(502, "Upload could not be confirmed");
      return reply(200);
    } catch {
      // No exception strings, bearer tokens, file bytes or privileged credentials
      // in responses/logs. An uncertain provider request stays charged/blocked.
      return reply(502, "Upload could not be confirmed");
    } finally {
      void request.body?.cancel().catch(() => {});
    }
  };
}

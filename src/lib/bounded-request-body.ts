type BodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too-large" | "timeout" | "unreadable" };

/** Bound actual bytes and total read time, including a peer that stops sending. */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
  timeoutMs = 5_000,
): Promise<BodyResult> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    void request.body?.cancel().catch(() => {});
    return { ok: false, reason: "too-large" };
  }
  if (!request.body) return { ok: false, reason: "unreadable" };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  const bytes = new Uint8Array(maxBytes);
  const deadline = performance.now() + timeoutMs;
  let total = 0;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    while (true) {
      // Also bound an immediately resolving stream that can starve timers.
      const remaining = deadline - performance.now();
      if (remaining <= 0) {
        return { ok: false, reason: "timeout" };
      }
      // Each race owns its timer promise, avoiding retained reactions for
      // every chunk on one long-lived pending timeout promise.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error("Request body deadline exceeded"));
        }, remaining);
      });
      const { done, value } = await Promise.race([reader.read(), timeout]);
      clearTimeout(timer);
      if (performance.now() >= deadline) {
        return { ok: false, reason: "timeout" };
      }
      if (done) break;
      if (value.byteLength > maxBytes - total) {
        return { ok: false, reason: "too-large" };
      }
      bytes.set(value, total);
      total += value.byteLength;
    }
    return {
      ok: true,
      text: new TextDecoder().decode(bytes.subarray(0, total)),
    };
  } catch {
    return { ok: false, reason: timedOut ? "timeout" : "unreadable" };
  } finally {
    clearTimeout(timer);
    // Cancellation may itself stall or reject. Never extend the read deadline
    // by awaiting it, and never leave a rejected cleanup promise unobserved.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

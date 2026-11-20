import { NextResponse } from "next/server";

import { readBoundedRequestBody } from "@/lib/bounded-request-body";
import { logger } from "@/lib/logger";
import { isSameOriginRequest } from "@/lib/request-origin";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_EVENTS = 12;
const METRICS = new Set(["LCP", "CLS", "INP", "TTFB", "FCP"]);
const STATIC_PATHS = new Set([
  "/",
  "/setups",
  "/setups/compare",
  "/upload",
  "/leaderboard",
  "/requests",
  "/engineer",
  "/garage",
  "/privacy",
  "/terms",
  "/community-guidelines",
  "/profile",
  "/account/data-deletion",
  "/report",
  "/auth/callback",
  "/auth/auth-code-error",
]);

interface SafeEvent {
  kind: "metric" | "pageview" | "error";
  name: string;
  path: string;
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 160 || !value.startsWith("/"))
    return null;
  if (value.startsWith("//") || /[?#\u0000-\u001f\u007f]/.test(value))
    return null;

  const path = value.length > 1 ? value.replace(/\/$/, "") : value;
  if (STATIC_PATHS.has(path)) return path;
  if (/^\/setups\/:id(?:\/edit)?$/.test(path)) return path;
  if (/^\/profile\/:id$/.test(path)) return path;
  return null;
}

function sanitizeEvent(input: unknown): SafeEvent | null {
  if (!isRecord(input)) return null;
  const path = safePath(input.path);
  if (!path || typeof input.kind !== "string" || typeof input.name !== "string")
    return null;

  if (input.kind === "pageview" && input.name === "pageview") {
    return { kind: "pageview", name: "pageview", path };
  }

  if (input.kind === "metric" && METRICS.has(input.name)) {
    const value = input.value;
    const rating = input.rating;
    const max = input.name === "CLS" ? 10 : 300_000;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > max
    )
      return null;
    if (
      rating !== "good" &&
      rating !== "needs-improvement" &&
      rating !== "poor"
    )
      return null;
    return {
      kind: "metric",
      name: input.name,
      path,
      value,
      rating,
    };
  }

  if (
    input.kind === "error" &&
    ["window.error", "unhandledrejection", "react.error-boundary"].includes(
      input.name,
    )
  ) {
    // Do not store raw exception text, stack traces, URLs, or user-provided data.
    return { kind: "error", name: input.name, path };
  }

  return null;
}

/** Receives path-only performance and error-category events from the browser. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (!isSameOriginRequest(request, origin)) {
        return new NextResponse(null, {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
    } catch {
      return new NextResponse(null, {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  const bodyResult = await readBoundedRequestBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return new NextResponse(null, {
      status: bodyResult.reason === "timeout" ? 408 : 413,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyResult.text);
  } catch {
    return new NextResponse(null, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!isRecord(payload) || !Array.isArray(payload.events)) {
    return new NextResponse(null, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const events = payload.events
    .slice(0, MAX_EVENTS)
    .map(sanitizeEvent)
    .filter((event): event is SafeEvent => event !== null);

  if (events.length > 0) logger.info("client telemetry", { events });
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

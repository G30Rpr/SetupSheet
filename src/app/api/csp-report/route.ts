import { NextResponse } from "next/server";

import { readBoundedRequestBody } from "@/lib/bounded-request-body";
import { logger } from "@/lib/logger";
import { isSameOriginRequest } from "@/lib/request-origin";

/**
 * Receives CSP violation reports from the browser and writes sanitized details
 * to the structured server log. The route is public by design, so both bytes
 * read and work/log volume per request are bounded. Deployments should still
 * add an edge/WAF request-rate limit; a stateless serverless process cannot
 * enforce a reliable global per-IP quota on its own.
 */
const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_LENGTH = 500;
const MAX_REPORTS_PER_REQUEST = 20;
const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function truncate(value: unknown): string {
  if (typeof value !== "string") return "";
  const safe = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  return safe.length > MAX_FIELD_LENGTH
    ? `${safe.slice(0, MAX_FIELD_LENGTH)}…`
    : safe;
}

/** Keep same-origin path context, but never log query strings, fragments or raw external paths. */
function sanitizeUri(value: unknown, requestUrl: string): string {
  if (typeof value !== "string" || value.length > 4096) return "";
  const raw = value.trim();
  if (!raw) return "";
  if (
    /^(?:'self'|'none'|'inline'|'eval'|self|none|inline|eval|data:|blob:|about:blank)$/i.test(
      raw,
    )
  ) {
    return truncate(raw);
  }

  try {
    const base = new URL(requestUrl);
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return `${url.protocol}`;
    if (url.origin !== base.origin) return url.origin;
    const path = url.pathname.replace(UUID, ":id");
    return truncate(`${url.origin}${path}`);
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  // Browsers may omit Origin for reporting uploads, but if present it must be
  // same-origin. This is not a replacement for rate limiting, just a cheap
  // guard against cross-origin form posts.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (!isSameOriginRequest(request, origin)) {
        return new NextResponse(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      }
    } catch {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  const bodyResult = await readBoundedRequestBody(request, MAX_BODY_BYTES);
  if (!bodyResult.ok)
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });

  let payload: unknown;
  try {
    payload = JSON.parse(bodyResult.text);
  } catch {
    // Reporting endpoints must not trigger client retries or expose parser errors.
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const body = payload as {
    "csp-report"?: Record<string, unknown>;
    "csp-violation"?: Record<string, unknown>;
  } | null;

  const reports: Record<string, unknown>[] = [];
  if (body?.["csp-report"]) reports.push(body["csp-report"]);
  if (body?.["csp-violation"]) reports.push(body["csp-violation"]);
  if (Array.isArray(payload)) {
    for (const entry of payload.slice(0, MAX_REPORTS_PER_REQUEST)) {
      const report = (entry as { body?: Record<string, unknown> })?.body;
      if (report) reports.push(report);
    }
  }

  for (const report of reports.slice(0, MAX_REPORTS_PER_REQUEST)) {
    logger.warn("CSP violation", {
      blockedURI: sanitizeUri(
        report["blocked-uri"] ?? report["blockedURI"],
        request.url,
      ),
      violatedDirective: truncate(
        report["violated-directive"] ?? report["effectiveDirective"],
      ),
      documentURI: sanitizeUri(
        report["document-uri"] ?? report["documentURL"],
        request.url,
      ),
      sourceFile: sanitizeUri(
        report["source-file"] ?? report["sourceFile"],
        request.url,
      ),
      lineNumber: truncate(
        String(report["line-number"] ?? report["lineNumber"] ?? ""),
      ),
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

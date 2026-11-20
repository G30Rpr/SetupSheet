import { NextResponse } from "next/server";

import { readBoundedRequestBody } from "@/lib/bounded-request-body";
import { sampleReportLog } from "@/lib/report-log-sampling";
import { safeReportPath } from "@/lib/reporting-paths";
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
const MAX_REPORTS_PER_REQUEST = 20;
const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const DIRECTIVES = new Set([
  "default-src",
  "script-src",
  "script-src-elem",
  "script-src-attr",
  "style-src",
  "style-src-elem",
  "style-src-attr",
  "img-src",
  "connect-src",
  "font-src",
  "object-src",
  "media-src",
  "child-src",
  "frame-src",
  "worker-src",
  "manifest-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "navigate-to",
  "prefetch-src",
  "sandbox",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
  "require-trusted-types-for",
  "trusted-types",
  "report-uri",
  "report-to",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeDirective(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const directive = value.trim().split(/\s+/, 1)[0];
  return DIRECTIVES.has(directive) ? directive : "unknown";
}

function safeLineNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !/^[0-9]{1,9}$/.test(value))
    return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 999_999_999
    ? number
    : undefined;
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
    return raw;
  }

  try {
    const base = new URL(requestUrl);
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return [
        "data:",
        "blob:",
        "about:",
        "javascript:",
        "chrome-extension:",
        "moz-extension:",
        "safari-extension:",
      ].includes(url.protocol)
        ? url.protocol
        : "other:";
    }
    if (url.origin !== base.origin) return url.origin;
    const path = url.pathname.replace(UUID, ":id");
    const safe = path.startsWith("/_next/static/")
      ? "/_next/static/:asset"
      : safeReportPath(path);
    return `${url.origin}${safe ?? "/:redacted"}`;
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

  const reports: Record<string, unknown>[] = [];
  if (isRecord(payload)) {
    if (isRecord(payload["csp-report"])) reports.push(payload["csp-report"]);
    if (isRecord(payload["csp-violation"]))
      reports.push(payload["csp-violation"]);
  }
  if (Array.isArray(payload)) {
    for (const entry of payload.slice(0, MAX_REPORTS_PER_REQUEST)) {
      if (isRecord(entry) && isRecord(entry.body)) reports.push(entry.body);
    }
  }

  if (reports.length > 0) {
    const sampleRate = sampleReportLog();
    if (sampleRate !== null) {
      logger.warn("CSP violation", {
        sampleRate,
        reports: reports.slice(0, MAX_REPORTS_PER_REQUEST).map((report) => ({
          blockedURI: sanitizeUri(
            report["blocked-uri"] ?? report["blockedURI"],
            request.url,
          ),
          violatedDirective: safeDirective(
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
          lineNumber: safeLineNumber(
            report["line-number"] ?? report["lineNumber"],
          ),
        })),
      });
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

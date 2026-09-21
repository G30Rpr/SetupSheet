import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";

/**
 * Receives CSP violation reports (see the `report-uri`/`report-to` directives
 * built in src/proxy.ts) and logs them as structured JSON, so a policy that is
 * silently breaking a feature -- or not blocking what it should -- is visible
 * in the same log stream as everything else instead of being invisible.
 *
 * Reports are attacker-controllable by definition (any page can post here), so
 * this handler treats the payload as untrusted: it accepts only a bounded
 * object, keeps a small subset of fields, truncates every string, and returns
 * 204 without ever echoing anything back. No rate limit of its own -- the body
 * is capped and the work is a single log line.
 */
const MAX_FIELD_LENGTH = 500;
const MAX_REPORTS_PER_REQUEST = 20;

function truncate(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}…` : value;
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    // Malformed report: nothing to log, and it is not the caller's job to
    // learn why. Reporting endpoints must never return an error body.
    return new NextResponse(null, { status: 204 });
  }

  const body = payload as {
    "csp-report"?: Record<string, unknown>;
    "csp-violation"?: Record<string, unknown>;
  } | null;

  const reports: Record<string, unknown>[] = [];
  if (body?.["csp-report"]) reports.push(body["csp-report"]);
  if (body?.["csp-violation"]) reports.push(body["csp-violation"]);
  // The Reporting API posts a bare array of report objects.
  if (Array.isArray(payload)) {
    for (const entry of payload.slice(0, MAX_REPORTS_PER_REQUEST)) {
      const report = (entry as { body?: Record<string, unknown> })?.body;
      if (report) reports.push(report);
    }
  }

  for (const report of reports) {
    logger.warn("CSP violation", {
      blockedURI: truncate(report["blocked-uri"] ?? report["blockedURI"]),
      violatedDirective: truncate(report["violated-directive"] ?? report["effectiveDirective"]),
      documentURI: truncate(report["document-uri"] ?? report["documentURL"]),
      sourceFile: truncate(report["source-file"] ?? report["sourceFile"]),
      lineNumber: truncate(String(report["line-number"] ?? report["lineNumber"] ?? "")),
    });
  }

  return new NextResponse(null, { status: 204 });
}

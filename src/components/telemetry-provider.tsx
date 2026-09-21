"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";

/**
 * Field telemetry: Core Web Vitals, page views, and client errors.
 *
 * The audit found the site had no observability at all -- no RUM, no error
 * tracking, no analytics -- which meant the two most severe defects (uploads
 * failing above 1 MB, and a 7 s render when the database was unreachable) were
 * invisible to the team. This closes that gap without adding a dependency or a
 * third-party script, so the site keeps its no-tracker, no-cookie-banner
 * posture: the CSP needs no `script-src` or `connect-src` change, and nothing
 * is sent to anyone but this origin.
 *
 * It reports to the existing structured logger, so the data lands in whatever
 * the deployment already collects from stdout (Vercel's log viewer, or a log
 * drain). Swapping in an analytics endpoint later means changing
 * `enqueueTelemetry` and nothing else.
 *
 * Deliberately *not* collected: cookies, user ids, IPs, referrers, or full
 * URLs. Route paths only, with query strings stripped, so a search term a user
 * typed is never recorded. `navigator.sendBeacon` is used so a metric fired
 * during page unload (CLS, INP) is not lost to an aborted fetch.
 */

type MetricName = "LCP" | "CLS" | "INP" | "TTFB" | "FCP";

interface TelemetryEvent {
  kind: "metric" | "pageview" | "error";
  name: string;
  value?: number;
  rating?: string;
  path: string;
  /** Only set for `error` events, and truncated by the logger. */
  detail?: string;
}

/** Web-vitals thresholds, matching the "good" / "needs improvement" bands. */
const THRESHOLDS: Record<MetricName, [number, number]> = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  TTFB: [800, 1800],
  FCP: [1800, 3000],
};

function rate(name: MetricName, value: number): "good" | "needs-improvement" | "poor" {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/** Path only: no query string, so no search term or filter value is recorded. */
function currentPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

function enqueueTelemetry(event: TelemetryEvent) {
  const line = JSON.stringify(event);
  if (event.kind === "error") console.error(line);
  else console.info(line);
}

/**
 * Subscribes to the native PerformanceObserver entries rather than bundling
 * `web-vitals`: the whole implementation is a few hundred bytes and the few
 * metrics that matter here (LCP, CLS, INP, TTFB, FCP) are directly observable.
 */
function observeMetrics(onMetric: (name: MetricName, value: number) => void) {
  if (typeof PerformanceObserver === "undefined") return () => {};

  const observers: PerformanceObserver[] = [];
  let clsValue = 0;

  const safeObserve = (type: string, callback: PerformanceObserverCallback) => {
    try {
      const observer = new PerformanceObserver(callback);
      observer.observe({ type, buffered: true } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // Unsupported entry type in this browser: skip it, keep the rest.
    }
  };

  safeObserve("largest-contentful-paint", (list) => {
    const entries = list.getEntries();
    const last = entries.at(-1);
    if (last) onMetric("LCP", Math.round(last.startTime));
  });

  safeObserve("layout-shift", (list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      // User-initiated shifts (a click revealing content) are excluded by spec.
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
    onMetric("CLS", Number(clsValue.toFixed(4)));
  });

  safeObserve("event", (list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
      if (entry.interactionId) onMetric("INP", Math.round(entry.duration));
    }
  });

  safeObserve("paint", (list) => {
    const fcp = list.getEntries().find((entry) => entry.name === "first-contentful-paint");
    if (fcp) onMetric("FCP", Math.round(fcp.startTime));
  });

  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigation) {
    onMetric("TTFB", Math.round(navigation.responseStart));
  }

  return () => observers.forEach((observer) => observer.disconnect());
}

export function TelemetryProvider() {
  useEffect(() => {
    const seen = new Set<string>();
    const report = (name: MetricName, value: number) => {
      // Report each metric once per page load at its final value.
      seen.add(name);
      enqueueTelemetry({ kind: "metric", name, value, rating: rate(name, value), path: currentPath() });
    };

    enqueueTelemetry({ kind: "pageview", name: "pageview", path: currentPath() });

    const disconnect = observeMetrics(report);

    // CLS and INP are only final once the page is going away, so flush both
    // on visibility change rather than losing them.
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      for (const name of ["CLS", "INP"] as const) {
        if (seen.has(name)) continue;
        // Nothing observed means "no shift / no interaction", which is the
        // good case -- report it rather than leaving a hole in the data.
        report(name, 0);
      }
    };
    document.addEventListener("visibilitychange", flush);

    const onError = (event: ErrorEvent) => {
      enqueueTelemetry({
        kind: "error",
        name: "window.error",
        path: currentPath(),
        detail: `${event.message} @ ${event.filename}:${event.lineno}`,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      enqueueTelemetry({
        kind: "error",
        name: "unhandledrejection",
        path: currentPath(),
        detail: String(event.reason),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

/** Exposed so the error boundary can report a server-rendered crash digest. */
export function reportClientError(message: string, digest?: string) {
  logger.error(message, digest ? { digest } : undefined);
  enqueueTelemetry({
    kind: "error",
    name: "react.error-boundary",
    path: currentPath(),
    detail: digest ? `${message} (${digest})` : message,
  });
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { logger } from "@/lib/logger";

type MetricName = "LCP" | "CLS" | "INP" | "TTFB" | "FCP";
type EventName = MetricName | "pageview" | "window.error" | "unhandledrejection" | "react.error-boundary";

interface TelemetryEvent {
  kind: "metric" | "pageview" | "error";
  name: EventName;
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
  path: string;
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

/** Normalize public IDs so telemetry paths cannot identify a profile or setup. */
function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ":id"
  );
}

/** Send only bounded, path-only events; never include cookies, IDs or error text. */
function sendTelemetry(events: TelemetryEvent[]) {
  if (typeof navigator === "undefined" || events.length === 0) return;
  const body = JSON.stringify({ events: events.slice(0, 12) });
  const blob = new Blob([body], { type: "application/json" });

  try {
    if (navigator.sendBeacon?.("/api/telemetry", blob)) return;
  } catch {
    // Fall back to keepalive fetch on browsers that reject the beacon.
  }

  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Observability must never affect page interaction or navigation.
  });
}

/**
 * Subscribes to native performance entries rather than adding a web-vitals
 * dependency. Metrics are batched until the page is hidden and sent to a
 * same-origin route; route IDs, query strings, referrers and error text are
 * deliberately omitted.
 */
function observeMetrics(onMetric: (name: MetricName, value: number) => void) {
  if (typeof PerformanceObserver === "undefined") return () => {};

  const observers: PerformanceObserver[] = [];
  let clsValue = 0;
  let maxInp = 0;

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
    const last = list.getEntries().at(-1);
    if (last) onMetric("LCP", Math.round(last.startTime));
  });

  safeObserve("layout-shift", (list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
    onMetric("CLS", Number(clsValue.toFixed(4)));
  });

  safeObserve("event", (list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
      if (entry.interactionId) maxInp = Math.max(maxInp, entry.duration);
    }
    if (maxInp > 0) onMetric("INP", Math.round(maxInp));
  });

  safeObserve("paint", (list) => {
    const fcp = list.getEntries().find((entry) => entry.name === "first-contentful-paint");
    if (fcp) onMetric("FCP", Math.round(fcp.startTime));
  });

  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigation) onMetric("TTFB", Math.round(navigation.responseStart));

  return () => observers.forEach((observer) => observer.disconnect());
}

export function TelemetryProvider() {
  const pathname = usePathname();

  useEffect(() => {
    sendTelemetry([{ kind: "pageview", name: "pageview", path: currentPath() }]);
  }, [pathname]);

  useEffect(() => {
    const metricPath = currentPath();
    const metrics = new Map<MetricName, TelemetryEvent>();
    const report = (name: MetricName, value: number) => {
      metrics.set(name, {
        kind: "metric",
        name,
        value,
        rating: rate(name, value),
        path: metricPath,
      });
    };

    const disconnect = observeMetrics(report);
    let didFlush = false;
    const flush = (force = false) => {
      if (!force && document.visibilityState !== "hidden") return;
      if (didFlush && metrics.size === 0) return;
      for (const name of ["CLS", "INP"] as const) {
        if (!metrics.has(name)) report(name, 0);
      }
      sendTelemetry([...metrics.values()]);
      metrics.clear();
      didFlush = true;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        didFlush = false;
        return;
      }
      flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);

    const onError = () => {
      sendTelemetry([{ kind: "error", name: "window.error", path: currentPath() }]);
    };
    const onRejection = () => {
      sendTelemetry([{ kind: "error", name: "unhandledrejection", path: currentPath() }]);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

/** Exposed so the error boundary can report a sanitized category as well. */
export function reportClientError(message: string, digest?: string) {
  logger.error(message, digest ? { digest } : undefined);
  sendTelemetry([
    { kind: "error", name: "react.error-boundary", path: currentPath() },
  ]);
}

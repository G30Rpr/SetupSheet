"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for an error thrown by the root layout itself
 * (rare -- error.tsx can't catch that, since it renders inside the
 * layout). Must render its own <html>/<body> since it replaces the
 * layout too; kept to inline styles rather than Tailwind classes since
 * this is the one place that has to assume nothing else can be trusted.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0d0b",
          color: "#eaeee9",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#8b9990", margin: "0 0 20px" }}>
            SetupSheet hit a snag loading this page. Give it another try.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#2ac45c",
              color: "#08130d",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

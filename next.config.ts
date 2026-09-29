import type { NextConfig } from "next";

// The Content-Security-Policy header is set per-request in src/proxy.ts
// instead of here, since script-src needs a fresh nonce on every request --
// next.config.ts's headers() can only return a static value computed once at
// build/server-start time. Everything below is genuinely static, so it stays
// here.
const nextConfig: NextConfig = {
  // Arena's browser preview is served from a per-session e2b.app subdomain;
  // Next's dev-resource origin guard must allow that host for HMR and chunks.
  allowedDevOrigins: ["*.e2b.app"],
  poweredByHeader: false,
  experimental: {
    // Server Action request bodies default to 1 MB. File uploads no longer
    // travel through an action -- the browser PUTs straight to Supabase
    // Storage with a signed URL (src/lib/upload-client.ts), because Vercel
    // caps a serverless function's request body at ~4.5 MB and could never
    // carry the advertised 5 MB / 10 MB files. This stays as headroom for
    // form submits with large text fields, and to turn any future oversized
    // POST into an explicit 413 instead of a confusing failure. Keep it well
    // under the platform ceiling.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      // Endpoint for the CSP `report-to` directive set in src/proxy.ts.
      {
        key: "Reporting-Endpoints",
        value: 'csp-endpoint="/api/csp-report"',
      },
      // HSTS on an HTTP localhost development server makes browsers rewrite
      // future local URLs to HTTPS. Only advertise it for real production
      // responses, where TLS is guaranteed.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ]
        : []),
    ];

    return [
      { source: "/(.*)", headers },
      {
        source: "/opengraph-image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/setups/:id/opengraph-image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

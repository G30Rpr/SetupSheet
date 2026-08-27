import type { NextConfig } from "next";

// The Content-Security-Policy header is set per-request in src/proxy.ts
// instead of here, since script-src needs a fresh nonce on every request --
// next.config.ts's headers() can only return a static value computed once at
// build/server-start time. Everything below is genuinely static, so it stays
// here.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
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

    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;

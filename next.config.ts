import type { NextConfig } from "next";

// The Content-Security-Policy header is set per-request in src/proxy.ts
// instead of here, since script-src needs a fresh nonce on every request --
// next.config.ts's headers() can only return a static value computed once at
// build/server-start time. Everything below is genuinely static, so it stays
// here.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

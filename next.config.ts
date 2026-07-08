import type { NextConfig } from "next";

// Least-privilege CSP for what this app actually does: same-origin pages
// and Server Actions, next/font self-hosted fonts, avatars/setup files
// served from Discord's CDN and Supabase Storage (both https), and the
// Supabase client's own REST/auth calls (plus its realtime websocket,
// which the SDK can open even though this app doesn't subscribe to any
// channel). No inline framing anywhere else on the web, no third-party
// scripts at all.
//
// 'unsafe-eval' is added to script-src in development only -- webpack's
// dev-mode Fast Refresh wraps modules in eval(), which the production
// bundle never does, so this doesn't loosen anything for real visitors.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

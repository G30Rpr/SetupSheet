const PRODUCTION_URL = "https://setupsheet.app";

/**
 * Vercel sets VERCEL_ENV/VERCEL_URL on every deployment, preview builds
 * included. Without this, metadataBase/canonical links/the sitemap would
 * all advertise the production domain even when viewed from a preview
 * deployment -- a shared preview link would unfurl with production's
 * content instead of the preview's.
 */
export const SITE_URL =
  process.env.VERCEL_ENV === "production"
    ? PRODUCTION_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : PRODUCTION_URL;

export const SITE_NAME = "SetupSheet";

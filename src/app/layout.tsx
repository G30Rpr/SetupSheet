import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

import { AppToaster } from "@/components/app-toaster";
import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getNotifications, getUnreadNotificationCount } from "@/lib/supabase/notifications";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = `${SITE_NAME} — Free Community Sim Racing Setups`;
const description =
  "Download and share free sim racing setups for iRacing, Assetto Corsa, Le Mans Ultimate, F1 25 and more. Built by the community, for the community.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The one hand-authored inline <script> in this app -- everything else
  // Next injects itself for hydration and picks up this same nonce
  // automatically once it's present on the CSP response header (set in
  // src/proxy.ts).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const supabase = await createClient();

  // A network-level failure (DNS, connection refused) throws here rather
  // than resolving to a catchable { error } result -- without this, an
  // unreachable Supabase project would crash the entire root layout on
  // every page, not just degrade the data that depends on it.
  let user = null;
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch (error) {
    logger.error("RootLayout: failed to fetch current user", error);
  }

  const [initialNotifications, initialUnreadCount] = user
    ? await Promise.all([getNotifications(user.id, 10), getUnreadNotificationCount(user.id)])
    : [[], 0];

  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} nonce={nonce}>
          <AuthProvider initialUser={user}>
            <SiteHeader
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
            />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </AuthProvider>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

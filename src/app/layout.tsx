import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

import { AppToaster } from "@/components/app-toaster";
import { AuthProvider } from "@/components/auth-provider";
import { JsonLd } from "@/components/json-ld";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { TelemetryProvider } from "@/components/telemetry-provider";
import { DEFAULT_SITE_DESCRIPTION, absoluteUrl, fullPageTitle } from "@/lib/seo";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { getNotifications, getUnreadNotificationCount } from "@/lib/supabase/notifications";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = fullPageTitle("Free Community Sim Racing Setups");
const description = DEFAULT_SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: `%s — ${SITE_NAME}`,
  },
  description,
  applicationName: SITE_NAME,
  category: "sports",
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  // No `alternates.canonical` here on purpose. Metadata set on the root layout
  // is inherited by every route that does not override it -- which includes the
  // not-found branches, /_not-found and /auth/* -- so a site-wide canonical made
  // every one of those pages tell crawlers "the canonical copy of this URL is the
  // homepage". Each page that wants a canonical declares its own (see page.tsx
  // and the route pages); nothing else needs a fallback.
  icons: { icon: "/icon.svg" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    title,
    description,
    url: SITE_URL,
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [absoluteUrl("/opengraph-image")],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/icon.svg"),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description,
      publisher: { "@id": `${SITE_URL}#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/setups?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const supabase = await createClient();

  // A network-level auth failure is handled by getCurrentUser(), so an
  // unreachable Supabase project degrades the layout to logged-out instead
  // of crashing every page. The per-request cache also lets data loaders
  // reuse this same auth lookup.
  const user = await getCurrentUser(supabase);

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
        <JsonLd data={jsonLd} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* SC 2.4.1: the header carries a logo, up to eight nav links, a search
            box, theme toggle, notification bell and account menu, and it is
            sticky on every page -- without this, keyboard users tab through all
            of it to reach the content. Rendered before the header so it is the
            first focusable element; visible only once focused. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        >
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} nonce={nonce}>
          <AuthProvider initialUser={user}>
            <SiteHeader
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
            />
            {/* tabIndex={-1} so the skip link moves focus here instead of
                only scrolling, which is what makes it work for screen readers
                as well as keyboard users. */}
            <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter />
          </AuthProvider>
          <AppToaster />
          {/* Field Core Web Vitals + client error reporting; renders nothing. */}
          <TelemetryProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}

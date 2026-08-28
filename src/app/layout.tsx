import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

import { AppToaster } from "@/components/app-toaster";
import { AuthProvider } from "@/components/auth-provider";
import { JsonLd } from "@/components/json-ld";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
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
  alternates: { canonical: SITE_URL },
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

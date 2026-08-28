import { headers } from "next/headers";

import { serializeJsonLd } from "@/lib/seo";

/** Renders nonce-protected structured data without duplicating CSP plumbing in every route. */
export async function JsonLd({ data }: { data: unknown }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { RelatedSetups } from "@/components/related-setups";
import { SetupCard } from "@/components/setup-card";
import { getSetupById, getSetupSeoData } from "@/lib/supabase/setups";
import { absoluteUrl, fullPageTitle, truncateMetaDescription } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { isUuid } from "@/lib/utils";

/**
 * Shape guard, not a lookup: setup ids are UUIDs, so a path like
 * `/setups/not-a-uuid` can never resolve. Checking the shape first keeps junk
 * traffic from spending a `unstable_cache` entry and a PostgREST round trip per
 * distinct string. `src/proxy.ts` does the same for the OG-image route, which is
 * the expensive one.
 *
 * Deliberately *not* `notFound()` here: the root layout is dynamic and streams,
 * so the document status is already committed as 200 by the time a page throws,
 * and Next 16 exposes no supported way to set it from a Server Component. The
 * noindex directive is what actually keeps these URLs out of the index, and the
 * response carries no canonical/og:image for a page that has no content.
 */
const NOT_FOUND_METADATA = {
  title: "Setup not found",
  robots: { index: false, follow: false },
} satisfies Metadata;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return NOT_FOUND_METADATA;

  const setup = await getSetupSeoData(id);

  if (!setup) return NOT_FOUND_METADATA;

  const title = `${setup.car} @ ${setup.track}`;
  const socialTitle = fullPageTitle(title);
  const description = truncateMetaDescription(
    setup.description ||
      `A free ${setup.game} setup for the ${setup.car} at ${setup.track}, shared by ${setup.author}.`
  );
  const url = `/setups/${encodeURIComponent(id)}`;
  // The OG route is CDN-cacheable for a day per URL (next.config.ts), so the URL
  // has to change when the setup does -- otherwise an edited setup keeps serving
  // its old card image to every unfurling bot for 24h.
  const ogImageUrl = absoluteUrl(
    `${url}/opengraph-image?v=${encodeURIComponent(ogImageVersion(setup, id))}`
  );

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${url}` },
    openGraph: {
      title: socialTitle,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      publishedTime: setup.createdAt,
      modifiedTime: setup.updatedAt,
      authors: [setup.author],
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [ogImageUrl] },
  };
}

/** Cache-busting token for the OG image: the setup's last edit, or its id. */
function ogImageVersion(setup: { updatedAt: string; createdAt: string }, fallbackId: string): string {
  const parsed = Date.parse(setup.updatedAt || setup.createdAt);
  return Number.isNaN(parsed) ? fallbackId : String(parsed);
}

export default async function SetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // See NOT_FOUND_METADATA above for why this is notFound() here but a plain
  // metadata short-circuit in generateMetadata.
  if (!isUuid(id)) notFound();

  const setup = await getSetupById(id);

  if (!setup) notFound();

  const canonicalPath = `/setups/${encodeURIComponent(setup.id)}`;
  const setupUrl = absoluteUrl(canonicalPath);
  const authorUrl = absoluteUrl(`/profile/${encodeURIComponent(setup.authorId)}`);
  const setupTitle = `${setup.car} @ ${setup.track}`;
  const setupDescription = truncateMetaDescription(
    setup.description || `A free ${setup.game} setup for the ${setup.car} at ${setup.track}.`
  );

  // The visible card shows a Pace and a Predictability average from real
  // first-party ratings, each 1-5. `ratingValue` is their mean so the number
  // in a rich result matches what the page shows, and the count gates emission
  // entirely: AggregateRating with zero ratings is invalid markup and Google
  // treats a rating with no raters as spam.
  const ratingCount = setup.ratingCount ?? 0;
  const aggregateRating =
    ratingCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(((setup.pace + setup.predictability) / 2).toFixed(1)),
          bestRating: 5,
          worstRating: 1,
          ratingCount,
        }
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${setupUrl}#article`,
        headline: setupTitle,
        description: setupDescription,
        author: { "@type": "Person", name: setup.author, url: authorUrl },
        datePublished: setup.uploadedAt,
        dateModified: setup.updatedAt ?? setup.uploadedAt,
        mainEntityOfPage: { "@id": setupUrl },
        image: absoluteUrl(`${canonicalPath}/opengraph-image`),
        publisher: { "@id": `${SITE_URL}#organization` },
        isAccessibleForFree: true,
        inLanguage: "en-US",
        keywords: [setup.game, setup.car, setup.track, setup.condition],
        ...(aggregateRating ? { aggregateRating } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Browse Setups", item: absoluteUrl("/setups") },
          { "@type": "ListItem", position: 3, name: setupTitle, item: setupUrl },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/setups" className="transition-colors hover:text-foreground">Browse Setups</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="max-w-[14rem] truncate text-foreground">{setupTitle}</li>
        </ol>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {setup.car} <span className="text-muted-foreground">@ {setup.track}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {setup.game} · {setup.condition} setup
        </p>
      </div>

      <SetupCard setup={setup} linkTitle={false} />

      <Suspense fallback={null}>
        <RelatedSetups setupId={setup.id} game={setup.game} />
      </Suspense>
    </div>
  );
}

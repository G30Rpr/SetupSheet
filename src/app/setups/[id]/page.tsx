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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const setup = await getSetupSeoData(id);

  if (!setup) {
    return { title: "Setup not found", robots: { index: false, follow: false } };
  }

  const title = `${setup.car} @ ${setup.track}`;
  const socialTitle = fullPageTitle(title);
  const description = truncateMetaDescription(
    setup.description ||
      `A free ${setup.game} setup for the ${setup.car} at ${setup.track}, shared by ${setup.author}.`
  );
  const url = `/setups/${encodeURIComponent(id)}`;

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
      images: [{ url: absoluteUrl(`${url}/opengraph-image`), width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [absoluteUrl(`${url}/opengraph-image`)] },
  };
}

export default async function SetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setup = await getSetupById(id);

  if (!setup) notFound();

  const canonicalPath = `/setups/${encodeURIComponent(setup.id)}`;
  const setupUrl = absoluteUrl(canonicalPath);
  const authorUrl = absoluteUrl(`/profile/${encodeURIComponent(setup.authorId)}`);
  const setupTitle = `${setup.car} @ ${setup.track}`;
  const setupDescription = truncateMetaDescription(
    setup.description || `A free ${setup.game} setup for the ${setup.car} at ${setup.track}.`
  );

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

import type { Metadata } from "next";
import { Flame, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { JsonLd } from "@/components/json-ld";
import { SetupRequestCard } from "@/components/setup-request-card";
import { fullPageTitle } from "@/lib/seo";
import { SetupRequestForm } from "@/components/setup-request-form";
import { getAllSetupRequests, getMostWantedRequests } from "@/lib/supabase/setup-requests";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "Setup Requests";
const socialTitle = fullPageTitle(title);
const description =
  "Ask the community for a setup you can't find, or fulfill someone else's request with one of your own.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/requests` },
  openGraph: { title: socialTitle, description, url: "/requests", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: socialTitle, description },
};

export default async function RequestsPage() {
  const [mostWanted, requests] = await Promise.all([
    getMostWantedRequests(5),
    getAllSetupRequests(),
  ]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${SITE_URL}/requests`,
    isPartOf: { "@id": `${SITE_URL}#website` },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <JsonLd data={jsonLd} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Setup Requests</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      </div>

      {mostWanted.length > 0 && (
        <Card as="section" aria-labelledby="most-wanted-heading" className="mb-8 gap-3 px-5 py-4">
          <h2 id="most-wanted-heading" className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Flame className="size-4 text-racing-coral" />
            Most wanted
          </h2>
          <ul className="flex flex-col gap-2">
            {mostWanted.map((entry) => (
              <li
                key={`${entry.game}-${entry.car}-${entry.track}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  <span className="font-medium">{entry.car}</span> @ {entry.track}
                  <span className="text-muted-foreground"> · {entry.game}</span>
                </span>
                <Badge variant="amber">
                  {entry.requestCount} {entry.requestCount === 1 ? "request" : "requests"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-8">
        <SetupRequestForm />
      </div>

      <section aria-labelledby="request-list-heading">
        <h2 id="request-list-heading" className="mb-4 text-xl font-semibold tracking-tight">
          Community requests
        </h2>
        {requests.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No requests yet"
            description="Be the first to ask the community for a setup."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((request) => (
              <li key={request.id}>
                <SetupRequestCard request={request} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

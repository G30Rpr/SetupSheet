import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetupCard } from "@/components/setup-card";
import { getSetupById } from "@/lib/supabase/setups";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const setup = await getSetupById(id);

  if (!setup) {
    return { title: `Setup not found — ${SITE_NAME}` };
  }

  const title = `${setup.car} @ ${setup.track} — ${SITE_NAME}`;
  const description =
    setup.description ||
    `A free ${setup.game} setup for the ${setup.car} at ${setup.track}, shared by ${setup.author}.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/setups/${id}` },
    openGraph: {
      title,
      description,
      url: `/setups/${id}`,
      type: "article",
      siteName: SITE_NAME,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setup = await getSetupById(id);

  if (!setup) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-red/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-red-400 ring-1 ring-inset ring-racing-red/30">
            <AlertCircle className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Setup not found</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              This setup may have been deleted, or the link is incorrect.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/setups">Back to Browse Setups</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/setups"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Browse Setups
      </Link>

      <SetupCard setup={setup} linkTitle={false} />
    </div>
  );
}

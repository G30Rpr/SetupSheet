import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ReportContentForm } from "@/components/report-content-form";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Card } from "@/components/ui/card";
import type { ReportTargetType } from "@/lib/actions/content-reports";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Report Content",
  description: "Report unsafe, abusive, spam, or misleading SetupSheet content.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/report` },
};

function getTargetType(value: string | undefined): ReportTargetType | null {
  return value === "setup" || value === "comment" || value === "profile" ? value : null;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const params = await searchParams;
  const targetType = getTargetType(params.type);
  const targetId = params.id;
  const validTarget = targetType !== null && isUuid(targetId);
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to {SITE_NAME}
      </Link>

      <div className="mb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-racing-coral">Community safety</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Report Content</h1>
        <p className="mt-2 text-muted-foreground">
          Help us review content that may be unsafe, abusive, misleading, or inappropriate.
        </p>
      </div>

      {!validTarget ? (
        <Card className="gap-3 px-6 py-10">
          <h2 className="text-xl font-semibold">Report link is invalid</h2>
          <p className="text-sm text-muted-foreground">
            Open the report link from the setup or comment you want a project operator to review.
          </p>
        </Card>
      ) : !user ? (
        <Card className="items-center gap-4 border-racing-green/30 px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">Log in to submit a report</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Reports are tied to your account so operators can prevent duplicate or abusive submissions.
          </p>
          <DiscordLoginButton />
        </Card>
      ) : (
        <ReportContentForm targetType={targetType} targetId={targetId} />
      )}
    </div>
  );
}

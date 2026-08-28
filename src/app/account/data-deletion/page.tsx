import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { AccountDeletionRequest } from "@/components/account-deletion-request";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getAccountDeletionRequest } from "@/lib/supabase/account-deletion";
import { createClient } from "@/lib/supabase/server";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Account and Data Deletion",
  description: "Request manual deletion of your SetupSheet account and associated data.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/account/data-deletion` },
};

export default async function DataDeletionPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/privacy" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to Privacy Policy
      </Link>

      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-racing-green">
          <ShieldCheck className="size-4" />
          Account privacy
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Account and Data Deletion</h1>
        <p className="mt-2 text-muted-foreground">
          Request removal of your {SITE_NAME} account and associated public contributions.
        </p>
      </div>

      {!user ? (
        <Card className="items-center gap-4 border-racing-green/30 px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">Log in to submit a request</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sign in with Discord so the request can be tied to the correct account.
          </p>
          <DiscordLoginButton />
        </Card>
      ) : (
        <AccountDeletionRequest initialRequest={await getAccountDeletionRequest(user.id)} />
      )}
    </div>
  );
}

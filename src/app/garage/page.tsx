import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";

import { GarageDashboard } from "@/components/garage/garage-dashboard";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getGarageSessionDetail, getGarageSessions } from "@/lib/supabase/garage";

export const metadata: Metadata = {
  title: "Garage",
  description: "Private sim-racing sessions, setup revisions, run plans, and lap notes.",
  robots: { index: false, follow: false },
};

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-cyan/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-cyan/10 text-racing-cyan ring-1 ring-inset ring-racing-cyan/25">
            <LockKeyhole className="size-7" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Log in to open your Garage</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Garage sessions, setup snapshots, run-plan notes, and lap times are private to your account.
            </p>
          </div>
          <DiscordLoginButton />
        </Card>
      </div>
    );
  }

  const [params, sessionList] = await Promise.all([
    searchParams,
    getGarageSessions(user.id),
  ]);
  const requestedId = Array.isArray(params.session) ? params.session[0] : params.session;
  const selectedSession = sessionList.sessions.find((session) => session.id === requestedId)
    ?? sessionList.sessions[0]
    ?? null;
  const detailResult = selectedSession
    ? await getGarageSessionDetail(user.id, selectedSession.id)
    : { detail: null, error: false };

  return (
    <GarageDashboard
      key={selectedSession?.id ?? "empty-garage"}
      sessions={sessionList.sessions}
      detail={detailResult.detail}
      listError={sessionList.error}
      detailError={detailResult.error}
    />
  );
}

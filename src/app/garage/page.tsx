import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";

import { GarageDashboard } from "@/components/garage/garage-dashboard";
import { DiscordLoginButton } from "@/components/auth-nav";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getGarageSessionDetail, getGarageSessions } from "@/lib/supabase/garage";
import { getSetupById } from "@/lib/supabase/setups";
import { countGarageSetupValues, type GarageSetupSource } from "@/lib/garage";
import { ENGINEER_GAMES, type EngineerGame } from "@/lib/engineer-types";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Garage",
  description: "Private sim-racing sessions, setup revisions, run plans, and lap notes.",
  robots: { index: false, follow: false },
};

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[]; from?: string | string[] }>;
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

  let sourceSetup: GarageSetupSource | null = null;
  let sourceSetupError: string | null = null;
  if (params.from !== undefined) {
    const requestedSetupId = Array.isArray(params.from)
      ? params.from.length === 1 ? params.from[0] : null
      : params.from;

    if (!requestedSetupId || !isUuid(requestedSetupId)) {
      sourceSetupError = "That setup link is invalid. Open a public ACC or LMU setup and try again.";
    } else {
      try {
        const setup = await getSetupById(requestedSetupId);
        if (!setup) {
          sourceSetupError = "That public setup could not be found. It may have been removed.";
        } else if (!ENGINEER_GAMES.includes(setup.game as EngineerGame)) {
          sourceSetupError = "Starting a Garage session from a setup is currently supported for ACC and Le Mans Ultimate only.";
        } else {
          const game = setup.game as EngineerGame;
          sourceSetup = {
            id: setup.id,
            game,
            car: setup.car,
            track: setup.track,
            condition: setup.condition,
            setupValueCount: countGarageSetupValues(game, setup.setupValues),
          };
        }
      } catch {
        sourceSetupError = "The public setup could not be loaded right now. Please try again.";
      }
    }
  }

  return (
    <GarageDashboard
      key={`${selectedSession?.id ?? "empty-garage"}:${sourceSetup?.id ?? "no-source"}`}
      sessions={sessionList.sessions}
      detail={detailResult.detail}
      listError={sessionList.error}
      detailError={detailResult.error}
      sourceSetup={sourceSetup}
      sourceSetupError={sourceSetupError}
    />
  );
}

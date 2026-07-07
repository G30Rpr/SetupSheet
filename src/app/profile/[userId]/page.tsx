import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfileView } from "@/components/profile-view";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/profiles";
import { getSetupsByUser } from "@/lib/supabase/setups";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getProfile(userId);
  return { title: profile ? `${profile.username} — SetupSheet` : "Profile — SetupSheet" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    profile,
    setups,
  ] = await Promise.all([supabase.auth.getUser(), getProfile(userId), getSetupsByUser(userId)]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-red/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-red-400 ring-1 ring-inset ring-racing-red/30">
            <AlertCircle className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Profile not found</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              This user may not exist, or the link is incorrect.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/leaderboard">Back to Leaderboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <ProfileView
      displayName={profile.username}
      avatarUrl={profile.avatarUrl ?? undefined}
      memberSince={profile.memberSince}
      setups={setups}
      isOwnProfile={user?.id === userId}
    />
  );
}

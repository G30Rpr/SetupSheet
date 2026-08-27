import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfileView } from "@/components/profile-view";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isFollowing } from "@/lib/supabase/follows";
import { getProfile } from "@/lib/supabase/profiles";
import { getSetupsByUser, PROFILE_SETUPS_LIMIT } from "@/lib/supabase/setups";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const profile = await getProfile(userId);

  if (!profile) {
    return { title: `Profile — ${SITE_NAME}`, robots: { index: false } };
  }

  const title = `${profile.username} — ${SITE_NAME}`;
  const url = `/profile/${userId}`;

  return {
    title,
    alternates: { canonical: `${SITE_URL}${url}` },
    openGraph: { title, url, type: "profile", siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const [user, profile, setups] = await Promise.all([
    getCurrentUser(supabase),
    getProfile(userId),
    getSetupsByUser(userId),
  ]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-red/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-red/15 text-racing-red ring-1 ring-inset ring-racing-red/30">
            <AlertCircle className="size-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Profile not found</h1>
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

  const viewerIsOwner = user?.id === userId;
  const viewerFollowsThem = !viewerIsOwner && (await isFollowing(user?.id ?? null, userId));

  return (
    <ProfileView
      key={userId}
      displayName={profile.username}
      avatarUrl={profile.avatarUrl ?? undefined}
      memberSince={profile.memberSince}
      followerCount={profile.followerCount}
      follow={viewerIsOwner ? undefined : { targetUserId: userId, initialIsFollowing: viewerFollowsThem }}
      setups={setups}
      setupsCapped={setups.length === PROFILE_SETUPS_LIMIT}
      isOwnProfile={viewerIsOwner}
    />
  );
}

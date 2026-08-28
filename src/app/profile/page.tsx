import type { Metadata } from "next";
import { PenLine } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DiscordLoginButton } from "@/components/auth-nav";
import { ProfileView } from "@/components/profile-view";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getProfile } from "@/lib/supabase/profiles";
import { getFavoritedSetups } from "@/lib/supabase/setup-favorites";
import { getProfileSetupStats, getSetupsByUserPage } from "@/lib/supabase/setups";
import { normalizeHttpsUrl } from "@/lib/safe-url";
import { fullPageTitle } from "@/lib/seo";
import { getUserDisplayName } from "@/lib/user-display";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const title = "My Profile";
const socialTitle = fullPageTitle(title);
const description = "Manage your SetupSheet profile, shared setups, and saved setups.";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/profile` },
  openGraph: { title: socialTitle, description, url: "/profile", type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: socialTitle, description },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-green/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
            <PenLine className="size-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Log in to view your profile</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              We use Discord to keep track of who uploaded what, so your
              profile and setups are scoped to your own account.
            </p>
          </div>
          <DiscordLoginButton />
        </Card>
      </div>
    );
  }

  const [profile, setupPage, stats, favoritedSetups] = await Promise.all([
    getProfile(user.id),
    getSetupsByUserPage(user.id),
    getProfileSetupStats(user.id),
    getFavoritedSetups(user.id),
  ]);

  const displayName = profile?.username ?? getUserDisplayName(user);
  const avatarUrl = profile?.avatarUrl ?? normalizeHttpsUrl(user.user_metadata?.avatar_url);

  return (
    <ProfileView
      key={user.id}
      displayName={displayName}
      avatarUrl={avatarUrl ?? undefined}
      memberSince={profile?.memberSince}
      followerCount={profile?.followerCount ?? 0}
      setups={setupPage.setups}
      stats={stats}
      pagination={{ profileId: user.id, nextCursor: setupPage.nextCursor }}
      setupsError={setupPage.error}
      favoritedSetups={favoritedSetups}
      isOwnProfile
    />
  );
}

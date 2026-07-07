import type { Metadata } from "next";
import { PenLine } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DiscordLoginButton } from "@/components/auth-nav";
import { ProfileView } from "@/components/profile-view";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/profiles";
import { getSetupsByUser } from "@/lib/supabase/setups";

export const metadata: Metadata = {
  title: "My Profile — SetupSheet",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="items-center gap-4 border-racing-green/30 px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-racing-green/15 text-racing-green ring-1 ring-inset ring-racing-green/30">
            <PenLine className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Log in to view your profile</h2>
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

  const [profile, setups] = await Promise.all([
    getProfile(user.id),
    getSetupsByUser(user.id),
  ]);

  const displayName =
    profile?.username ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Racer";
  const avatarUrl = profile?.avatarUrl ?? (user.user_metadata?.avatar_url as string | undefined);

  return (
    <ProfileView
      displayName={displayName}
      avatarUrl={avatarUrl}
      memberSince={profile?.memberSince}
      setups={setups}
      isOwnProfile
    />
  );
}

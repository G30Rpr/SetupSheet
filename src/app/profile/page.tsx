import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, PenLine, Star, TrendingUp, Upload } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DiscordLoginButton } from "@/components/auth-nav";
import { SetupCard } from "@/components/setup-card";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/supabase/profiles";
import { getSetupsByUser } from "@/lib/supabase/setups";

export const metadata: Metadata = {
  title: "My Profile — SimSetups",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

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
  const totalUpvotes = setups.reduce((sum, s) => sum + s.upvotes, 0);
  const totalRatings = setups.reduce((sum, s) => sum + s.ratingCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Card className="mb-8 flex-row flex-wrap items-center gap-5 px-5 py-6 sm:px-8">
        <Avatar className="size-16 ring-1 ring-border">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-racing-green/15 text-lg text-racing-green">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          {profile?.memberSince && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="size-3.5" />
              Member since {formatDate(profile.memberSince)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold tabular-nums">{setups.length}</span>
            <span className="text-xs text-muted-foreground">Setups</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 text-lg font-semibold tabular-nums text-racing-green">
              <TrendingUp className="size-4" />
              {totalUpvotes}
            </span>
            <span className="text-xs text-muted-foreground">Upvotes</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 text-lg font-semibold tabular-nums">
              <Star className="size-4" />
              {totalRatings}
            </span>
            <span className="text-xs text-muted-foreground">Ratings</span>
          </div>
        </div>
      </Card>

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Your Setups</h2>
        <Button asChild size="sm">
          <Link href="/upload">
            <Upload />
            Upload Setup
          </Link>
        </Button>
      </div>

      {setups.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {setups.map((setup) => (
            <SetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 py-16 text-center">
          <p className="font-medium">You haven&apos;t shared any setups yet</p>
          <p className="text-sm text-muted-foreground">
            Upload your first setup and it&apos;ll show up here.
          </p>
          <Button asChild size="sm">
            <Link href="/upload">Upload Your Setup</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

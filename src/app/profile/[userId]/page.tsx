import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { ProfileView } from "@/components/profile-view";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isFollowing } from "@/lib/supabase/follows";
import { getProfile } from "@/lib/supabase/profiles";
import { getProfileSetupStats, getSetupsByUserPage } from "@/lib/supabase/setups";
import { absoluteUrl, fullPageTitle } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { isUuid } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  // Shape guard before any lookup; see the same note in
  // src/app/setups/[id]/page.tsx (a mid-render notFound() cannot set the HTTP
  // status while the layout streams, so noindex is what does the work here).
  if (!isUuid(userId)) {
    return { title: "Profile not found", robots: { index: false, follow: false } };
  }

  const profile = await getProfile(userId);

  if (!profile) {
    return { title: "Profile not found", robots: { index: false, follow: false } };
  }

  const title = profile.username;
  const socialTitle = fullPageTitle(title);
  const description = `View ${profile.username}'s community sim racing setups on ${SITE_NAME}.`;
  const url = `/profile/${encodeURIComponent(userId)}`;
  const image = profile.avatarUrl
    ? [{ url: profile.avatarUrl, alt: `${profile.username}'s avatar` }]
    : [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: socialTitle }];

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${url}` },
    openGraph: { title: socialTitle, description, url, type: "profile", siteName: SITE_NAME, images: image },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: image.map(({ url: imageUrl }) => imageUrl) },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!isUuid(userId)) notFound();

  const supabase = await createClient();
  const [user, profile] = await Promise.all([
    getCurrentUser(supabase),
    getProfile(userId),
  ]);

  if (!profile) notFound();

  const [setupPage, stats] = await Promise.all([
    getSetupsByUserPage(userId),
    getProfileSetupStats(userId),
  ]);
  const viewerIsOwner = user?.id === userId;
  const viewerFollowsThem = !viewerIsOwner && (await isFollowing(user?.id ?? null, userId));
  const profileUrl = absoluteUrl(`/profile/${encodeURIComponent(userId)}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: profileUrl,
    name: `${profile.username} on ${SITE_NAME}`,
    isPartOf: { "@id": `${SITE_URL}#website` },
    mainEntity: {
      "@type": "Person",
      name: profile.username,
      url: profileUrl,
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
      memberOf: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/leaderboard" className="transition-colors hover:text-foreground">Leaderboard</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="max-w-[14rem] truncate text-foreground">{profile.username}</li>
          </ol>
        </nav>
      </div>
      <ProfileView
        key={userId}
        displayName={profile.username}
        avatarUrl={profile.avatarUrl ?? undefined}
        memberSince={profile.memberSince}
        followerCount={profile.followerCount}
        follow={viewerIsOwner ? undefined : { targetUserId: userId, initialIsFollowing: viewerFollowsThem }}
        setups={setupPage.setups}
        stats={stats}
        pagination={{ profileId: userId, nextCursor: setupPage.nextCursor }}
        setupsError={setupPage.error}
        isOwnProfile={viewerIsOwner}
      />
    </>
  );
}

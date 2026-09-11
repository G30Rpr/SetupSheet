/**
 * Data Cache tag names, and the one place that decides which caches each
 * class of mutation invalidates.
 *
 * Granularity matters more than it looks. An upvote is by far the most common
 * write on this site, and every public reader used to share a single tag -- so
 * one click dropped the 500-row browse index for every filtered view, the
 * featured rail, and the sitemap's 24,000-row keyset walk (a 24-request
 * PostgREST scan whose one-hour `revalidate` window was meaningless the moment
 * any visitor clicked a star). Counters and content are now separate tags, and
 * caches that never render a counter (sitemap, SEO row, related links, total
 * setup count) are not invalidated by counter writes at all.
 *
 * This module deliberately imports nothing: the readers, the Server Actions,
 * and the unit tests all share these constants without pulling `next/cache`
 * into a module graph that client components touch.
 */
export const CACHE_TAG = {
  /** A setup row was created, edited, or deleted. */
  setupsContent: "setups-content",
  /** A denormalized counter moved (upvotes, rating averages, rating_count). */
  setupsCounters: "setups-counters",
  /** Only the id + created_at/updated_at set that `/sitemap.xml` renders. */
  setupsSitemap: "setups-sitemap",
  /** Public profile metadata (username, avatar, follower count). */
  publicProfiles: "public-profiles",
} as const;

export type CacheTag = (typeof CACHE_TAG)[keyof typeof CACHE_TAG];

/** Reader caches that render setup content *and* counter-derived numbers. */
export const SETUP_ROW_TAGS: readonly CacheTag[] = [
  CACHE_TAG.setupsContent,
  CACHE_TAG.setupsCounters,
];

/** Reader caches derived only from setup content (no counters, no ordering by them). */
export const SETUP_CONTENT_TAGS: readonly CacheTag[] = [CACHE_TAG.setupsContent];

/** The sitemap document's cache: ids and timestamps only. */
export const SETUP_SITEMAP_TAGS: readonly CacheTag[] = [CACHE_TAG.setupsSitemap];

/**
 * Tags a create/update/delete must invalidate. Content edits change what the
 * sitemap advertises (`lastModified` advances) and every derived number, so
 * this is the only mutation class that touches all three setup tags.
 */
export function tagsForContentMutation(): readonly CacheTag[] {
  return [CACHE_TAG.setupsContent, CACHE_TAG.setupsCounters, CACHE_TAG.setupsSitemap];
}

/**
 * Tags an upvote/rate mutation must invalidate. Deliberately *not* the content
 * tag: the setup row is unchanged, so the total setup count, the SEO row, the
 * related links, and the whole sitemap walk stay warm.
 */
export function tagsForCounterMutation(): readonly CacheTag[] {
  return [CACHE_TAG.setupsCounters];
}

/** Tags a follow mutation must invalidate (profile metadata only). */
export function tagsForProfileMutation(): readonly CacheTag[] {
  return [CACHE_TAG.publicProfiles];
}

import { describe, expect, it } from "vitest";

import {
  CACHE_TAG,
  SETUP_CONTENT_TAGS,
  SETUP_ROW_TAGS,
  SETUP_SITEMAP_TAGS,
  tagsForContentMutation,
  tagsForCounterMutation,
  tagsForProfileMutation,
} from "@/lib/cache-tags";

const ALL_TAGS: string[] = Object.values(CACHE_TAG);

describe("cache tag partitioning", () => {
  it("only ever uses declared tag names", () => {
    for (const tags of [SETUP_ROW_TAGS, SETUP_CONTENT_TAGS, SETUP_SITEMAP_TAGS]) {
      for (const tag of tags) expect(ALL_TAGS).toContain(tag);
    }
    for (const tags of [tagsForContentMutation(), tagsForCounterMutation(), tagsForProfileMutation()]) {
      for (const tag of tags) expect(ALL_TAGS).toContain(tag);
    }
  });

  it("never invalidates a cache with an empty tag list", () => {
    expect(tagsForContentMutation().length).toBeGreaterThan(0);
    expect(tagsForCounterMutation().length).toBeGreaterThan(0);
    expect(tagsForProfileMutation().length).toBeGreaterThan(0);
  });

  it("drops the caches that render counters when a counter moves", () => {
    // Browse rows, the featured rail, setup detail, and profile pages all
    // render upvote/rating numbers, so they must carry the counter tag.
    expect(SETUP_ROW_TAGS).toContain(CACHE_TAG.setupsCounters);
    expect(tagsForCounterMutation()).toContain(CACHE_TAG.setupsCounters);
  });

  it("keeps content-only caches warm across counter mutations", () => {
    // This is the whole point of the split: an upvote must not re-run the
    // sitemap's 24,000-row keyset walk, the exact-count query, the SEO row, or
    // the related-links read.
    const counterTags = tagsForCounterMutation();
    expect(counterTags).not.toContain(CACHE_TAG.setupsContent);
    expect(counterTags).not.toContain(CACHE_TAG.setupsSitemap);
    expect(counterTags).not.toContain(CACHE_TAG.publicProfiles);

    for (const tags of [SETUP_CONTENT_TAGS, SETUP_SITEMAP_TAGS]) {
      for (const tag of tags) expect(counterTags).not.toContain(tag);
    }
  });

  it("invalidates the sitemap and every setup cache when a row changes", () => {
    const contentTags = tagsForContentMutation();
    expect(contentTags).toContain(CACHE_TAG.setupsSitemap);

    // Every reader tag set must be intersected by a content mutation, or an
    // edit would keep serving stale rows until the revalidate window expired.
    for (const tags of [SETUP_ROW_TAGS, SETUP_CONTENT_TAGS, SETUP_SITEMAP_TAGS]) {
      expect(tags.some((tag) => contentTags.includes(tag))).toBe(true);
    }
  });

  it("does not let a follow mutation touch the setup caches", () => {
    const profileTags = tagsForProfileMutation();
    expect(profileTags).toEqual([CACHE_TAG.publicProfiles]);
    for (const tag of profileTags) {
      expect(SETUP_CONTENT_TAGS).not.toContain(tag);
      expect(SETUP_SITEMAP_TAGS).not.toContain(tag);
    }
  });
});

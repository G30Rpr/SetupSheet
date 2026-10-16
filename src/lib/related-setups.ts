/**
 * Related setups (P2): same car + track, but a different rig or a different
 * tag/style mix — the point is to show the reader alternatives for the combo
 * they're looking at, not "more from this game".
 */

export interface RelatedCandidate {
  id: string;
  rigProfile: string;
  tags: string[];
}

function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((tag) => setA.has(tag));
}

/**
 * Picks related rows from candidates already filtered to the same car +
 * track (excluding the setup being viewed). A candidate qualifies when its
 * rig or its tag/style mix differs; different-rig rows come first, then the
 * caller's existing newest-first order decides the rest. Identical
 * duplicates (same rig + same tags) are never related.
 */
export function pickRelatedSetups<T extends RelatedCandidate>(
  candidates: T[],
  self: RelatedCandidate,
  limit = 6
): T[] {
  return candidates
    .filter((c) => c.id !== self.id && (c.rigProfile !== self.rigProfile || !sameTags(c.tags, self.tags)))
    .map((c, index) => ({ c, index, differentRig: c.rigProfile !== self.rigProfile }))
    .sort((a, b) => {
      if (a.differentRig !== b.differentRig) return a.differentRig ? -1 : 1;
      return a.index - b.index; // stable: keeps the caller's newest-first order
    })
    .slice(0, Math.max(limit, 1))
    .map((entry) => entry.c);
}

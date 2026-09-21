import { isUuid } from "@/lib/utils";

/**
 * Routes whose dynamic segment can only ever be a UUID: `/setups/<id>`,
 * `/setups/<id>/edit`, `/profile/<userId>` and their per-route
 * `opengraph-image` / `not-found` children.
 *
 * The optional trailing group keeps `/setups/<id>/edit` covered without a
 * second pattern, while `[^/]` guarantees exactly one segment is matched -- so
 * nothing deeper than the shapes below is ever intercepted.
 */
const ID_ROUTE_PATTERNS: readonly { pattern: RegExp; prefix: string }[] = [
  { pattern: /^\/setups\/([^/]+)(?:\/(?:edit|opengraph-image))?\/?$/, prefix: "/setups" },
  { pattern: /^\/profile\/([^/]+)(?:\/opengraph-image)?\/?$/, prefix: "/profile" },
];

/**
 * Static routes that sit alongside the dynamic `[id]` segment under the same
 * prefix. Next resolves a static segment before a dynamic one, so
 * `/setups/compare` is the comparison page -- not `/setups/[id]` holding a
 * junk id -- and must never be treated as an unresolvable id. Keep this in
 * sync when a new static sibling is added under either prefix;
 * `id-route-guard.test.ts` asserts each entry is preserved.
 */
const RESERVED_SEGMENTS: Record<string, ReadonlySet<string>> = {
  "/setups": new Set(["compare"]),
  "/profile": new Set([]),
};

/**
 * Returns the offending path segment when the request is for an id-addressed
 * route whose segment can never resolve, otherwise `null`.
 *
 * Used by `src/proxy.ts` to answer a hard 404 before any rendering happens.
 * Without it these URLs return HTTP 200 with a "not found" body, because the
 * root layout is dynamic and streams: by the time `notFound()` is called in a
 * page, the status line has already been sent.
 *
 * Being conservative is the whole job here -- a false positive would 404 a
 * real setup -- so only the shape is judged, never existence. A well-formed
 * UUID that happens to be missing still renders the `noindex` not-found page.
 */
export function unresolvableIdSegment(pathname: string): string | null {
  for (const { pattern, prefix } of ID_ROUTE_PATTERNS) {
    const match = pattern.exec(pathname);
    if (!match) continue;

    const segment = safeDecode(match[1]);
    if (RESERVED_SEGMENTS[prefix]?.has(segment)) return null;
    if (!isUuid(segment)) return segment;
    return null;
  }

  return null;
}

/**
 * A malformed percent-escape (`/%E0%A4%A`) makes `decodeURIComponent` throw.
 * Such a segment cannot be a UUID either way, so treat it as its raw form
 * rather than letting the exception escape from middleware.
 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

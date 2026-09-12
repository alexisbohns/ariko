/**
 * The one number that makes `lib/garden-cache.ts` a cache rather than a
 * decoration, and the warning that fires before it stops being one.
 *
 * Vercel's Data Cache refuses a single entry above 2 MB. Above that limit
 * `unstable_cache` does not throw and does not log — it simply declines to
 * cache, and every public request goes back to Mongo. The failure mode is a
 * performance regression that is indistinguishable, from inside the app, from
 * the thing working. So the ceiling is checked here rather than trusted.
 *
 * Measured 2026-09-11: the full garden is 411 kB, roughly 5x under. The warning
 * sits at 1.5 MB so it fires with room to act, not at the moment of failure.
 *
 * Pure, and in its own module, for `lib/locale.ts`'s reason: `garden-cache.ts`
 * imports `next/cache`, and this half has to stay exercisable under plain
 * `node --test`.
 */
export const GARDEN_WARN_BYTES = 1_500_000;

export function gardenCacheWarning(bytes: number): string | null {
  if (bytes < GARDEN_WARN_BYTES) return null;
  return (
    `garden is ${Math.round(bytes / 1000)} kB, approaching Vercel's 2 MB Data ` +
    `Cache entry limit. Above it unstable_cache silently declines to cache and ` +
    `every public request goes back to Mongo. Split the load per collection — ` +
    `docs/superpowers/specs/2026-09-11-cache-the-garden-design.md §3.5, §6.`
  );
}

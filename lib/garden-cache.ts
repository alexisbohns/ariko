import { revalidateTag, unstable_cache } from "next/cache";
import { buildDataset, filterPublic, type Dataset, type RawGarden } from "./data";
import { gardenCacheWarning } from "./garden-size";
import { loadRawGarden } from "./store";

/**
 * The public zone's read of the garden, and the only module in lib/ that knows
 * Next has a cache.
 *
 * TWO READERS, DELIBERATELY — this is the whole design and it is one import
 * away from being undone. `lib/store.ts`'s `loadRawGarden` stays live and is
 * what the admin and every server action read. This module's
 * `loadCachedGarden` is what the public zone reads. They are different names
 * rather than a flag because `editVersionAction` and `promoteSeedAction`
 * re-read AFTER writing, on purpose, so `publishCascade` evaluates the
 * just-saved state (there is a comment in actions.ts saying so). Hand those a
 * cached read and the cascade computes against the pre-write garden: an author
 * publishes a sprout and its bean stays private, or an unpublish leaves a
 * parent public that should have been re-privatised. That is a PRIVACY
 * regression produced by a caching change, and it passes tsc, npm test and
 * npm run build. `lib/garden-cache-source.test.ts` is what stops it.
 *
 * The TTL is a backstop, not the mechanism. `revalidateGarden()` at the four
 * write doors is what makes a publish appear immediately; GARDEN_TTL exists so
 * that a write path someone adds and forgets to wire degrades to "stale for
 * five minutes" rather than "stale until the next deploy".
 */
export const GARDEN_TAG = "garden";
export const GARDEN_TTL = 300; // seconds

async function loadGardenForCache(): Promise<RawGarden> {
  const raw = await loadRawGarden();
  // On a MISS only — never on the hit path, which is the one that matters.
  // Stringifying here (to measure) and again when Next writes the entry is
  // two passes over the garden, not one — the right trade at single-digit ms,
  // once per TTL, against a warning that would otherwise never fire.
  const warning = gardenCacheWarning(Buffer.byteLength(JSON.stringify(raw)));
  if (warning) console.warn(`[garden-cache] ${warning}`);
  return raw;
}

/**
 * `unstable_cache` stores what it's given as JSON: a MISS returns the
 * Mongo-shaped `RawGarden`, a HIT returns its JSON round-trip. Those are the
 * same value today only because the projection drops `_id` and every
 * timestamp in the garden is already a string. `RawGarden` has to stay
 * JSON-round-trip-safe for that to keep holding — a stored BSON `Date` would
 * be a `Date` on the miss and a string on every hit, in production only,
 * where the cache is warm.
 *
 * The `"garden"` cache key below and `GARDEN_TAG` are independent
 * namespaces that happen to share a literal — renaming one is not renaming
 * a reference to the other.
 */
export const loadCachedGarden = unstable_cache(loadGardenForCache, ["garden"], {
  tags: [GARDEN_TAG],
  revalidate: GARDEN_TTL,
});

/** Public site: published-only, read through the Data Cache. */
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadCachedGarden()));
}

/**
 * The message Next throws from `revalidateTag` when there is no request store.
 * Matched on rather than caught broadly — see `revalidateGarden`.
 */
const NO_REQUEST_STORE = "static generation store missing";

/**
 * Exported so the rethrow half of `revalidateGarden` is testable at all: the
 * tolerated case can be reproduced just by calling it under `node --test`, but
 * "everything else is rethrown" cannot be, without a way to name the predicate.
 */
export function isMissingRequestStore(err: unknown): boolean {
  return err instanceof Error && err.message.includes(NO_REQUEST_STORE);
}

/**
 * Called at the four write doors — the admin actions and the three API write
 * routes. Never in a writer in lib/: `lib/botanical.ts` and the stores are
 * called all over `npm run test:db`, and this would throw in every one.
 *
 * THE CATCH IS NARROW ON PURPOSE. The design for this slice claimed the four
 * doors were places "where node --test never runs", and that was simply wrong:
 * `lib/articles-route.test.ts` imports `POST` from `app/api/articles/route.ts`
 * and calls it against a real database, which is a genuinely good test — a
 * write door exercised end to end — and is not a Next request, so
 * `revalidateTag` has no store and throws. `lib/synthesis-route.test.ts` and
 * `lib/pollen-sync-route.test.ts` do the same for the other two doors.
 *
 * So exactly one condition is tolerated and everything else is rethrown. Every
 * way this can fail is loud:
 *
 *  - In production a route handler and a server action always HAVE a store, so
 *    the catch never runs and an invalidation is never quietly skipped.
 *  - If Next changes that message, the rethrow fires and `npm run test:db`
 *    goes red. Noisy, but it cannot fail silently into a stale public site.
 *
 * A broad `catch {}` here would have neither property, which is why the design
 * rejected error-swallowing in the writer layer. One narrow, asserted case at
 * one function is a different trade from twenty-five blind ones.
 * `lib/garden-cache.test.ts` pins both halves.
 */
export function revalidateGarden(): void {
  try {
    revalidateTag(GARDEN_TAG);
  } catch (err) {
    if (!isMissingRequestStore(err)) throw err;
  }
}

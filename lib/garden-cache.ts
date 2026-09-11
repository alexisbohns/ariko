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
export const GARDEN_TTL = 300;

async function loadGardenForCache(): Promise<RawGarden> {
  const raw = await loadRawGarden();
  // On a MISS only — never on the hit path, which is the one that matters.
  const warning = gardenCacheWarning(Buffer.byteLength(JSON.stringify(raw)));
  if (warning) console.warn(warning);
  return raw;
}

export const loadCachedGarden = unstable_cache(loadGardenForCache, ["garden"], {
  tags: [GARDEN_TAG],
  revalidate: GARDEN_TTL,
});

/** Public site: published-only, off the cache. */
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadCachedGarden()));
}

/**
 * Called at the four write doors — the admin actions and the three API write
 * routes. Never in a writer in lib/: those run under `npm run test:db` with no
 * Next request context, where revalidateTag throws.
 */
export function revalidateGarden(): void {
  revalidateTag(GARDEN_TAG);
}

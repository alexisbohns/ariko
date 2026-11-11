import { revalidateTag, unstable_cache } from "next/cache";
import { isMissingRequestStore } from "./garden-cache";
import { loadHoursSnapshot } from "./hours-store";

// The public zone's read of the hours snapshot, mirroring lib/garden-cache.ts:
// a tagged Data Cache entry, revalidated by the ingest door. The snapshot is
// plain JSON (strings and numbers), so a cache HIT equals a MISS.
//
// KEEP IT PLAIN JSON. unstable_cache stores the value as JSON, so a cache HIT
// returns what JSON.parse gives back, while a MISS returns what the store
// built. A Date (or undefined, Map, class instance...) in the snapshot would
// therefore be a Date on a MISS and a string on a HIT — the same page would
// render differently depending on cache state. Dates stay ISO strings.
export const HOURS_TAG = "hours";

export const getCachedHours = unstable_cache(loadHoursSnapshot, ["hours"], {
  tags: [HOURS_TAG],
  revalidate: 300,
});

/** Called by POST /api/hours after a write. Same narrow catch as revalidateGarden. */
export function revalidateHours(): void {
  try {
    revalidateTag(HOURS_TAG);
  } catch (err) {
    if (!isMissingRequestStore(err)) throw err;
  }
}

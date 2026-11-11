import { revalidateTag, unstable_cache } from "next/cache";
import { isMissingRequestStore } from "./garden-cache";
import { loadHoursSnapshot } from "./hours-store";

// The public zone's read of the hours snapshot, mirroring lib/garden-cache.ts:
// a tagged Data Cache entry, revalidated by the ingest door. The snapshot is
// plain JSON (strings and numbers), so a cache HIT equals a MISS.
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

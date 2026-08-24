import type { MediaImage, Sprout } from "./data";

/**
 * Pure (umbrella §5). A bean's cover is DERIVED — no field, no authoring step,
 * no migration. Given sprouts in the newest-first order the dataset already
 * guarantees (stable byDateDesc), returns the first MediaImage in the first
 * sprout that has one, or null.
 *
 * The umbrella says "the first MediaImage in its newest published sprout's
 * media[]", which could also be read as "strictly the newest sprout, or
 * nothing". Resolved toward this function's sibling, articleFor
 * (lib/article.ts), which returns the first sprout CARRYING content rather than
 * giving up at the newest: a bean whose latest sprout is a text-only changelog
 * entry keeps the cover its previous release earned.
 *
 * State is NOT re-checked here, exactly as in articleFor: the public page
 * passes the filterPublic-projected dataset, so "published" is already enforced
 * upstream. One projection, one place.
 */
export function coverFor(sprouts: Sprout[]): MediaImage | null {
  for (const sprout of sprouts) {
    const image = (sprout.media ?? []).find((m): m is MediaImage => m.kind === "image");
    if (image) return image;
  }
  return null;
}

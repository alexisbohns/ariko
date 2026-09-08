import type { MediaImage, Sprout } from "./data";

/**
 * Pure (umbrella §5). The DERIVATION of a bean's cover: given sprouts in the
 * newest-first order the dataset already guarantees (stable byDateDesc),
 * returns the first MediaImage in the first sprout that has one, or null.
 *
 * It is no longer the WHOLE story, and this function is not where the rest of
 * it lives. A bean may now carry an explicit `cover` (lib/data.ts, the
 * phone-covers slice), and that field TAKES PRECEDENCE over everything below.
 * The precedence is applied in lib/bean-cover.ts — `beanCoverFor` for a surface
 * that also decides the treatment, `fillCoverFor` for one that only wants the
 * image — and NOT here: this function is unchanged, sees no bean, and answers
 * only "what would this bean's sprouts give it". Every reader that draws a
 * bean's cover should call one of those two rather than this, or the override
 * is honoured on some surfaces and silently ignored on the rest.
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

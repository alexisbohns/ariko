import type { Seed } from "./data";

/**
 * The inbox, narrowed to a plant.
 *
 * A seed's plant is a SUGGESTION that arrived over the wire from a sibling
 * repo's lab note, so it can name a plant that was renamed or never existed.
 * The inbox already refuses to draw an avatar for one it cannot resolve — the
 * `plantMark` helper in `app/admin/inbox/page.tsx`. Filtering follows the same
 * rule from the other side: an absent suggestion is not evidence of
 * membership, so a seed that suggests nothing is kept only when there is no
 * scope to fail against. This function decides MEMBERSHIP, not what a rail or
 * a switcher goes on to render from the result — which is why it names no
 * page: a second caller changes nothing about the rule.
 *
 * Unresolvable-but-present is left alone on purpose: `?plant=ghost` narrows to
 * the seeds that say "ghost", which is exactly what was asked for — this
 * function has no opinion on whether "ghost" resolves to a real plant.
 *
 * An empty string reads as no scope too, by the same falsy check: a `?plant=`
 * with nothing after the `=` reaches here as `""`, which returns every seed
 * rather than filtering for a slug of the empty string — a comparison no seed
 * could ever satisfy.
 */
export function filterSeedsByPlant(seeds: Seed[], plant: string | null): Seed[] {
  // A fresh array either way: the filtered branch already returns one via
  // `.filter()`, and copying here too means a caller can treat both branches
  // the same rather than quietly holding a reference to its own array on the
  // no-scope path.
  if (!plant) return [...seeds];
  return seeds.filter((seed) => seed.suggested?.plantSlug === plant);
}

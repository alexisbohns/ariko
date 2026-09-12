import type { Seed } from "./data";

/**
 * The inbox, narrowed to a plant.
 *
 * A seed's plant is a SUGGESTION that arrived over the wire from a sibling
 * repo's lab note, so it can name a plant that was renamed or never existed.
 * The inbox already refuses to draw an avatar for one it cannot resolve
 * (`plantMark` in app/admin/inbox/page.tsx); filtering follows the same rule
 * from the other side — an absent suggestion is not evidence of membership, so
 * a seed that suggests nothing appears under All and under no plant.
 *
 * Unresolvable-but-present is left alone on purpose: `?plant=ghost` narrows to
 * the seeds that say "ghost", which is exactly what was asked for, and the
 * chrome above will be reading "All" because the garden has no such plant.
 */
export function filterSeedsByPlant(seeds: Seed[], plant: string | null): Seed[] {
  if (!plant) return seeds;
  return seeds.filter((seed) => seed.suggested?.plantSlug === plant);
}

import { resolveText, type Bean, type Dataset, type Pod, type Text } from "./data";

/**
 * What a plant contains, as the hub and the sections both need it.
 *
 * `Dataset.beansForPlant` is beans parented DIRECTLY to the plant. A plant's
 * real bean set is that plus the beans of each of its pods, and composing it
 * at a page would be a fourth way to miss one: the other three are
 * `beansForPlant` alone (misses pod beans), a hand-rolled concat that forgets
 * to dedupe (double-counts a bean parented to both a pod and its plant), and
 * copying `lib/palette.ts`'s move of reading `standaloneBeans()` in — which
 * would be wrong here rather than merely redundant, since `standaloneBeans()`
 * is beans with NO resolvable pod or plant parent, definitionally irrelevant
 * to "beans under plant X". `lib/palette.ts`'s docblock names that trap for
 * the GLOBAL case — there is no whole-bean accessor on `Dataset`, so faking
 * one by unioning every per-kind list is unsafe, which is why the palette
 * reads the raw garden instead of composing. The per-plant rollup below is a
 * narrower question with a safe, one-definition answer, and it is still worth
 * having exactly once.
 *
 * One definition, for two callers — the hub's preview and `/admin/beans`
 * scoped to a plant, neither built yet — so the preview's count and the
 * section's count will be the same number by construction rather than by
 * coincidence, once both exist.
 */

/**
 * The comparator both sorts share. `localeCompare` rather than the plain `<`
 * this repo otherwise reaches for on slugs (see `lib/screens.ts`,
 * `lib/exhibition.ts`) because these are PEOPLE-facing names, not ASCII
 * kebab-case slugs — and `resolveText` defaults to English, so this is
 * deliberately an English-name order regardless of the reader's language.
 *
 * `|| a.slug.localeCompare(b.slug)` is the tie-break: two beans or pods can
 * resolve to the same English name, and without a second key the order
 * between them is whatever the garden's own array order happened to be —
 * which is Mongo's, and would shuffle under the author between visits, the
 * same hazard `lib/screens.ts`'s capture-run sort names.
 */
function byName(a: { name: Text; slug: string }, b: { name: Text; slug: string }): number {
  return resolveText(a.name).localeCompare(resolveText(b.name)) || a.slug.localeCompare(b.slug);
}

/** Every bean under a plant: its own, and every pod's. Deduped by slug — a
 *  bean may name both a pod and that pod's plant in `parents`. Safe to sort
 *  the `Map`'s values directly (no defensive copy needed here, unlike
 *  `podsForPlantSorted` below): `[...seen.values()]` is already a fresh array
 *  this function built, not a reference into the dataset. */
export function beansForPlantDeep(dataset: Dataset, slug: string): Bean[] {
  const seen = new Map<string, Bean>();
  for (const bean of dataset.beansForPlant(slug)) seen.set(bean.slug, bean);
  for (const pod of dataset.podsForPlant(slug)) {
    for (const bean of dataset.beansForPod(pod.slug)) seen.set(bean.slug, bean);
  }
  return [...seen.values()].sort(byName);
}

/**
 * A plant's pods, by name — the order the hub and the section both show.
 *
 * The `[...]` is load-bearing, not decoration: `Dataset.podsForPlant` hands
 * back the dataset's OWN internal array by reference, not a copy, so
 * `.sort()` without it would reorder that shared array in place — every other
 * reader of `podsForPlant` for this plant would silently see name order
 * instead of garden order from then on. Dropping the spread reads as an
 * obvious tidy-up, passes `tsc`, `npm test` and `npm run build`, and is
 * exactly the silent-becomes-false CLAUDE.md's rules section warns about.
 *
 * Which is also the honest answer to why this function exists at all: not
 * for the sort (a one-line `.sort(byName)` at each call site would be no more
 * code), but for this defensive copy plus the one shared comparator — so
 * every caller gets the copy for free and cannot forget it.
 */
export function podsForPlantSorted(dataset: Dataset, slug: string): Pod[] {
  return [...dataset.podsForPlant(slug)].sort(byName);
}

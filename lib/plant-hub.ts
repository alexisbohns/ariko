import { resolveText, type Bean, type Dataset, type Pod, type Text } from "./data";

/**
 * What a plant contains, as the hub and the sections both need it.
 *
 * `Dataset.beansForPlant` is beans parented DIRECTLY to the plant. A plant's
 * real bean set is that plus the beans of each of its pods, and composing it at
 * a page would be a fourth way to miss one: lib/palette.ts's docblock already
 * names the trap — there is no whole-bean accessor on Dataset, and faking one
 * out of beansForPlant + beansForPod + standaloneBeans is three chances to drop
 * a bean.
 *
 * One definition, two callers — the hub's preview and `/admin/beans` scoped to
 * a plant — so the preview's count and the section's count are the same number
 * by construction rather than by coincidence.
 */

function byName(a: { name: Text }, b: { name: Text }): number {
  return resolveText(a.name).localeCompare(resolveText(b.name));
}

/** Every bean under a plant: its own, and every pod's. Deduped by slug — a
 *  bean may name both a pod and that pod's plant in `parents`. */
export function beansForPlantDeep(dataset: Dataset, slug: string): Bean[] {
  const seen = new Map<string, Bean>();
  for (const bean of dataset.beansForPlant(slug)) seen.set(bean.slug, bean);
  for (const pod of dataset.podsForPlant(slug)) {
    for (const bean of dataset.beansForPod(pod.slug)) seen.set(bean.slug, bean);
  }
  return [...seen.values()].sort(byName);
}

/** A plant's pods, by name. The order the hub and the section both show. */
export function podsForPlantSorted(dataset: Dataset, slug: string): Pod[] {
  return [...dataset.podsForPlant(slug)].sort(byName);
}
